import { GoogleGenAI as OCRProviderClient, Type as OCRSchemaType } from "@google/genai";
import fs from 'fs';

export class OCRService {
  private static readonly MAX_RETRIES = 5;

  private static readonly OCR_PROMPT = `Extract invoice items from this invoice as separate rows.
Requirements:
1. Return one JSON object per invoice line item. Never merge different products into one object.
2. Ignore non-product text such as company header, signatures, payment data, totals, tax, addresses, banking details, and generic notes.
3. "rawName" must contain the original full product line text exactly as it appears on the invoice.
4. "name" must contain only the clean normalized product name for database storage. Remove packaging fragments and any trailing fragment after "/" such as "/160 пачек". Remove only the quote characters around brands, but keep the brand text itself in the clean name.
5. "brand" should contain the extracted brand if visible, for example "SKIF" or "Мэй Фу".
6. "packageName" should contain the package label such as "мешок", "коробка", "упаковка", "box", "bag".
7. "baseUnitName" should contain the base unit inside the package such as "шт", "пачка", "флакон", "емкость".
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
14. Keep the product type, brand, and mass in the "name" when they are visible, for example "автомат SKIF 900гр" or "гель Мэй Фу для мытья посуды 1.5л".
Return only a JSON array of objects with "lineIndex", "rawName", "name", "brand", "packageName", "baseUnitName", "packageCount", "unitsPerPackage", "quantity", "price", "rawQuantity", "unit", "lineTotal", and "note".`;

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
        const retryDelay =
          error?.details?.find?.((entry: any) => String(entry?.['@type'] || '').includes('RetryInfo'))?.retryDelay
          || error?.retryDelay;
        const isBusyModel =
          status === 503 ||
          message.includes('503') ||
          message.includes('UNAVAILABLE') ||
          message.includes('high demand') ||
          message.toLowerCase().includes('overloaded');
        const isQuotaExceeded =
          status === 429 ||
          message.includes('429') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.toLowerCase().includes('quota exceeded') ||
          message.toLowerCase().includes('rate limit');

        if (isQuotaExceeded) {
          const quotaError = new Error(
            retryDelay
              ? `Лимит OCR временно исчерпан. Попробуйте снова через ${String(retryDelay).replace(/s$/i, ' сек')}.`
              : 'Лимит OCR временно исчерпан. Попробуйте позже или смените API ключ.'
          );
          (quotaError as any).status = 429;
          throw quotaError;
        }

        if (!isBusyModel || attempt === OCRService.MAX_RETRIES) {
          if (isBusyModel) {
            const busyError = new Error('OCR service is temporarily overloaded. Please try again in a few seconds.');
            (busyError as any).status = 503;
            throw busyError;
          }

          throw error;
        }

        const delayMs = Math.min(12000, 1500 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 500);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
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
              rawName: { type: OCRSchemaType.STRING },
              name: { type: OCRSchemaType.STRING },
              brand: { type: OCRSchemaType.STRING },
              packageName: { type: OCRSchemaType.STRING },
              baseUnitName: { type: OCRSchemaType.STRING },
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
