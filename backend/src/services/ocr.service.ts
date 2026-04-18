import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export class OCRService {
  static async parseInvoice(imagePath: string, mimeType: string = "image/jpeg") {
    const imageData = fs.readFileSync(imagePath).toString("base64");

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
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
              text: `
Extract invoice product rows from this document and return ONLY JSON.

Important business rules:
1. rawName:
   - Return the full original product line exactly as visible in the invoice.
2. name:
   - Return the clean product name ONLY before the first "(" bracket.
   - Keep weight/volume like 250 гр, 0.5л, 900 гр if they are before bracket.
3. sku:
   - Extract product code / item code if visible.
4. tnvedCode:
   - Extract TN VED / customs code if visible.
5. packageUnit:
   - Extract the outer package type if visible, such as "мешок", "коробка", "ящик", "блок", "упаковка".
6. packagesQty:
   - Extract how many outer packages were shipped.
   - Example: if invoice says 10 мешков, return 10.
7. piecesPerPackage:
   - Extract how many pieces are inside one package if visible.
   - Example from "(1 мешок-24 пачки)" => 24
   - Example from "(1 коробка-15 флаконов)" => 15
   - If not clear, return null.
8. totalPieces:
   - If total pieces are explicitly visible, extract them.
   - Example: "/240 пачек" => 240
   - If not visible but packagesQty and piecesPerPackage are known, calculate totalPieces.
   - If still unclear, return null.
9. price:
   - Extract unit price in USD for ONE OUTER PACKAGE, not per piece.
10. lineTotalUsd:
   - Extract full line total in USD if visible.
   - If not visible but packagesQty and price are known, calculate it.
11. Do not invent values. If something is unclear, use null.

Return an array of objects with these fields:
- rawName
- name
- sku
- tnvedCode
- packageUnit
- packagesQty
- piecesPerPackage
- totalPieces
- price
- lineTotalUsd
              `,
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
              rawName: { type: Type.STRING },
              name: { type: Type.STRING },
              sku: { type: Type.STRING },
              tnvedCode: { type: Type.STRING },
              packageUnit: { type: Type.STRING },
              packagesQty: { type: Type.NUMBER },
              piecesPerPackage: { type: Type.NUMBER },
              totalPieces: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              lineTotalUsd: { type: Type.NUMBER },
            },
            required: ["rawName", "name"],
          },
        },
      },
    });

    try {
      const parsed = JSON.parse(response.text || "[]");

      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: any) => ({
        rawName: typeof item.rawName === "string" ? item.rawName.trim() : "",
        name: typeof item.name === "string" ? item.name.trim() : "",
        sku: typeof item.sku === "string" ? item.sku.trim() : "",
        tnvedCode: typeof item.tnvedCode === "string" ? item.tnvedCode.trim() : "",
        packageUnit: typeof item.packageUnit === "string" ? item.packageUnit.trim() : "",
        packagesQty: typeof item.packagesQty === "number" ? item.packagesQty : null,
        piecesPerPackage: typeof item.piecesPerPackage === "number" ? item.piecesPerPackage : null,
        totalPieces: typeof item.totalPieces === "number" ? item.totalPieces : null,
        price: typeof item.price === "number" ? item.price : null,
        lineTotalUsd: typeof item.lineTotalUsd === "number" ? item.lineTotalUsd : null,
      }));
    } catch (e) {
      console.error("Failed to parse Gemini response:", response.text);
      return [];
    }
  }
}