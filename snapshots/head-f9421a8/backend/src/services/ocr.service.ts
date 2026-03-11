import { GoogleGenAI, Type } from "@google/genai";
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export class OCRService {
  static async parseInvoice(imagePath: string, mimeType: string = 'image/jpeg') {
    const imageData = fs.readFileSync(imagePath).toString('base64');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: imageData,
                mimeType: mimeType,
              },
            },
            {
              text: `Extract products from this invoice. 
              Requirements:
              1. 'name': Extract the full product name. If it includes weight/volume like "250 г", include it.
              2. 'quantity': The invoice might list quantities in bags (Мешок) or boxes (коробка). You MUST calculate the TOTAL quantity in pieces (шт/пачки/флаконы). Look for text like "(1 мешок-24 пачки)/240 пачек" and extract the total number of pieces (e.g., 240).
              3. 'price': Extract the unit price. If the price is in USD ($), extract it as a number.
              4. 'sku': Extract the SKU or code if available (e.g., "3402500000").
              Return a JSON array of objects with 'name', 'quantity', 'price', and 'sku'.`,
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

    try {
      return JSON.parse(response.text || '[]');
    } catch (e) {
      console.error("Failed to parse Gemini response:", response.text);
      return [];
    }
  }
}
