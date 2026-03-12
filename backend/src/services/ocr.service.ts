import { GoogleGenAI as OCRProviderClient, Type as OCRSchemaType } from "@google/genai";
import fs from 'fs';

export class OCRService {
  private static readonly MAX_RETRIES = 3;

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
        response = await ai.models.generateContent({
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
                  text: `Extract invoice items from this invoice as separate rows.
Requirements:
1. Return one JSON object per invoice line item. Never merge different products into one object.
2. Keep the original product wording. "name" must contain the full product name exactly as written, including weight, volume, flavor, packaging, and brand details.
3. If two lines have similar names, keep them as separate objects unless the line is literally the same repeated line.
4. "quantity": Convert packaging to the final total piece count only if the invoice clearly provides the conversion. If conversion is unclear, use the line quantity as-is.
5. "price": Extract the unit purchase price as a number. If the price is in USD ($), return the numeric USD value.
6. "sku": Extract SKU, customs code, barcode fragment, or article code if present.
7. "rawQuantity": Return the original quantity text exactly as shown on the invoice.
8. "unit": Return the unit or packaging text such as "pcs", "box", "bag", "kg", "уп", "шт".
9. "lineTotal": Return the total amount for the line if available.
10. "note": Return useful details for that exact line only, such as packaging conversion, color, scent, or remarks.
11. "lineIndex": Return the visible order number of the line from top to bottom starting with 1.
12. Do not invent values. If a field is missing, return an empty string for text fields or 0 for numeric fields.
Return only a JSON array of objects with "lineIndex", "name", "quantity", "price", "sku", "rawQuantity", "unit", "lineTotal", and "note".`,
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: OCRSchemaType.ARRAY,
              items: {
                type: OCRSchemaType.OBJECT,
                properties: {
                  lineIndex: { type: OCRSchemaType.NUMBER },
                  name: { type: OCRSchemaType.STRING },
                  quantity: { type: OCRSchemaType.NUMBER },
                  price: { type: OCRSchemaType.NUMBER },
                  sku: { type: OCRSchemaType.STRING },
                  rawQuantity: { type: OCRSchemaType.STRING },
                  unit: { type: OCRSchemaType.STRING },
                  lineTotal: { type: OCRSchemaType.NUMBER },
                  note: { type: OCRSchemaType.STRING },
                },
                required: ["lineIndex", "name", "quantity", "price"],
              },
            },
          },
        });
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

    try {
      return JSON.parse(response?.text || '[]');
    } catch {
      console.error("Failed to parse OCR response:", response?.text);
      return [];
    }
  }
}
