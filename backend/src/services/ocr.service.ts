import { GoogleGenAI as OCRProviderClient, Type as OCRSchemaType } from "@google/genai";
import fs from 'fs';

export class OCRService {
  private static readonly MAX_RETRIES = 3;

  private static readonly OCR_PROMPT = `Extract invoice items from this invoice as separate rows.
Requirements:
1. Return one JSON object per invoice line item. Never merge different products into one object.
2. "name" must contain only the base product name before the first opening parenthesis "(". If the invoice has extra details inside parentheses, do not include them in "name"; put them into "note" instead.
3. If two lines have similar names, keep them as separate objects unless the line is literally the same repeated line.
4. "packageCount": Return how many bags, boxes, or packages are listed on the line. If not available, return 0.
5. "unitsPerPackage": Return how many individual pieces are inside one bag, box, or package. If not available, return 0.
6. "quantity": Convert packaging to the final total pieces. If the invoice clearly says "10 bags x 24 pcs", return 240.
7. "price": Extract the purchase price for one bag, box, or package as a number. If the price is in USD ($), return the numeric USD value.
8. "rawQuantity": Return the original quantity text exactly as shown on the invoice.
9. "unit": Return the unit or packaging text such as "pcs", "box", "bag", "kg", "pack", "piece".
10. "lineTotal": Return the total amount for the line if available.
11. "note": Return useful details for that exact line only, such as packaging conversion, color, scent, or remarks.
12. "lineIndex": Return the visible order number of the line from top to bottom starting with 1.
13. Do not invent values. If a field is missing, omit it or return an empty string for text fields and 0 for numeric fields.
Return only a JSON array of objects with "lineIndex", "name", "packageCount", "unitsPerPackage", "quantity", "price", "rawQuantity", "unit", "lineTotal", and "note".`;

  static getClient() {
    const apiKey = process.env.OCR_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('OCR is not configured: OCR_API_KEY is missing');
    }

    return new OCRProviderClient({ apiKey });
  }

  static async parseInvoice(imagePath: string, mimeType: string = 'image/jpeg') {
    const ai = OCRService.getClient();
    const imageData = fs.readFileSync(imagePath).toString('base64');
    let response: { text?: string } | null = null;
    const model = process.env.OCR_MODEL?.trim();

    if (!model) {
      throw new Error('OCR is not configured: OCR_MODEL is missing');
    }

    for (let attempt = 1; attempt <= OCRService.MAX_RETRIES; attempt += 1) {
      try {
        try {
          response = await OCRService.generateStructuredContent(ai, model, imageData, mimeType);
        } catch {
          response = await OCRService.generateFallbackContent(ai, model, imageData, mimeType);
        }
        break;
      } catch (error: any) {
        const status = Number(error?.status || error?.code || error?.response?.status || 0);
        const message = String(error?.message || '');
        const isBusyModel =
          status === 503 ||
          message.includes('503') ||
          message.includes('UNAVAILABLE') ||
          message.includes('high demand');

        if (!isBusyModel || attempt === OCRService.MAX_RETRIES) {
          if (isBusyModel) {
            const busyError = new Error('OCR service is temporarily overloaded. Please try again in a few seconds.');
            (busyError as any).status = 503;
            throw busyError;
          }

          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }

    const parsed = OCRService.parseJsonFromText(response?.text || '');
    if (parsed.length > 0) {
      return parsed;
    }

    console.error('Failed to parse OCR response:', response?.text);
    return [];
  }

  private static parseJsonFromText(text: string) {
    const cleaned = String(text || '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    if (!cleaned) {
      return [];
    }

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      return [];
    }

    try {
      const parsed = JSON.parse(arrayMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.error('Failed to parse OCR fallback JSON:', cleaned);
      return [];
    }
  }

  static async generateStructuredContent(ai: OCRProviderClient, model: string, imageData: string, mimeType: string) {
    return ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: imageData,
                mimeType,
              },
            },
            {
              text: OCRService.OCR_PROMPT,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: OCRSchemaType.ARRAY,
          items: {
            type: OCRSchemaType.OBJECT,
            properties: {
              lineIndex: { type: OCRSchemaType.NUMBER },
              name: { type: OCRSchemaType.STRING },
              packageCount: { type: OCRSchemaType.NUMBER },
              unitsPerPackage: { type: OCRSchemaType.NUMBER },
              quantity: { type: OCRSchemaType.NUMBER },
              price: { type: OCRSchemaType.NUMBER },
              rawQuantity: { type: OCRSchemaType.STRING },
              unit: { type: OCRSchemaType.STRING },
              lineTotal: { type: OCRSchemaType.NUMBER },
              note: { type: OCRSchemaType.STRING },
            },
            required: ['name', 'quantity', 'price'],
          },
        },
      },
    });
  }

  static async generateFallbackContent(ai: OCRProviderClient, model: string, imageData: string, mimeType: string) {
    return ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: imageData,
                mimeType,
              },
            },
            {
              text: `${OCRService.OCR_PROMPT}

Reply with raw JSON only. Do not use markdown fences.`,
            },
          ],
        },
      ],
    });
  }
}
