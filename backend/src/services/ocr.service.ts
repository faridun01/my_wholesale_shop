import { GoogleGenAI, Type } from "@google/genai";
import fs from 'fs';

export class OCRService {
  private static readonly MAX_RETRIES = 3;

  static getClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('OCR is not configured: GEMINI_API_KEY is missing');
    }

    return new GoogleGenAI({ apiKey });
  }

  static async parseInvoice(imagePath: string, mimeType: string = 'image/jpeg') {
    const ai = OCRService.getClient();
    const imageData = fs.readFileSync(imagePath).toString('base64');
    let response: { text?: string } | null = null;

    for (let attempt = 1; attempt <= OCRService.MAX_RETRIES; attempt += 1) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
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
                  text: `Extract products from this invoice.
Requirements:
1. "name": Extract the full product name. If it includes weight or volume like "250 g", keep it.
2. "quantity": The invoice may list quantities in bags or boxes. You must convert them to total pieces. For example, if the invoice says "(1 bag - 24 packs) / 240 packs", return 240.
3. "price": Extract the unit price. If the price is in USD ($), return it as a number.
4. "sku": Extract the product SKU or customs code if available, for example "3402500000".
Return only a JSON array of objects with "name", "quantity", "price", and "sku".`,
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                  sku: { type: Type.STRING },
                },
                required: ["name", "quantity", "price"],
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
      console.error("Failed to parse Gemini response:", response?.text);
      return [];
    }
  }
}
