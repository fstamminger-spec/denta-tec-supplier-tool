import { ParsedProduct } from "../types";
import { BACKEND_URL } from "../config";

const AI_ERROR_MSG = "AI Service unavailable. Please try again later.";

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getMimeType(file: File): string {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
        pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg',
        jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    };
    return mimeMap[ext || ''] || 'application/octet-stream';
}

export const geminiService = {
    getGoogleShoppingHeaderMapping: async (originalHeaders: string[]): Promise<Record<string, string | null>> => {
        const prompt = `You are an expert in product data and shopping feeds. Analyze the following list of column headers from a supplier file: ${JSON.stringify(originalHeaders)}.
    
    Map them to the standard Google Shopping attributes: 'id', 'title', 'description', 'link', 'image_link', 'price', 'brand', 'gtin', 'mpn', 'cost_of_goods_sold'.
    
    Respond ONLY with a single JSON object where keys are the original headers and values are the mapped Google attribute (or null if no match).`;

        try {
            const response = await fetch(`${BACKEND_URL}/api/gemini/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-flash-latest',
                    contents: [{ parts: [{ text: prompt }] }],
                    config: { responseMimeType: "application/json" }
                })
            });
            const data = await response.json();
            let jsonStr = data.text.trim();
            if (jsonStr.startsWith("```")) {
                jsonStr = jsonStr.replace(/^```json\s?/, "").replace(/```$/, "");
            }
            return JSON.parse(jsonStr) as Record<string, string | null>;
        } catch (e: any) {
            console.error("Header mapping error:", e);
            const fallback: Record<string, string | null> = {};
            originalHeaders.forEach(h => fallback[h] = null);
            return fallback;
        }
    },

    optimizeProductTitle: async (currentTitle: string, description: string, brand?: string): Promise<string> => {
        const prompt = `Optimize this product title for Google Shopping SEO (German).
      Current Title: "${currentTitle}"
      Brand: "${brand || ''}"
      Context from Description: "${description.substring(0, 500)}..."
      
      Rules:
      1. Place strong keywords (Brand, Product Type, Key Feature) at the beginning.
      2. Keep it under 150 characters (ideal 70-100).
      3. No promotional text (e.g. "Sale", "Best Offer").
      4. Return ONLY the new title text.`;

        try {
            const response = await fetch(`${BACKEND_URL}/api/gemini/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-flash-latest',
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const data = await response.json();
            return data.text.trim();
        } catch (e) {
            throw new Error(AI_ERROR_MSG);
        }
    },

    analyzeProductAttributes: async (product: ParsedProduct): Promise<any> => {
        const contextText = `Analyze product "${product.title}" & desc "${product.description.substring(0, 1000)}". 
      1. Dominant color (or 'Multicolor'). 
      2. Google Product Category string.
      3. Risk Score ('Low', 'Medium', 'High').
      4. Image CVR style ('Action Shot', 'On Model', 'Flat Lay', '3D Render', 'Product Only', 'Other').
      Output JSON.`;

        try {
            const response = await fetch(`${BACKEND_URL}/api/gemini/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-flash-latest',
                    contents: [{ parts: [{ text: contextText }] }],
                    config: { responseMimeType: "application/json" }
                })
            });
            const data = await response.json();
            const result = JSON.parse(data.text);

            return {
                aiColor: result.color,
                aiCategory: result.category,
                aiRiskScore: result.riskScore,
                aiRiskDetails: result.riskDetails,
                aiImageType: result.imageType,
                aiImageScore: result.contentScore || 50,
                aiImageReason: result.imageReason,
            };
        } catch (e) { throw new Error(AI_ERROR_MSG); }
    },

    visualizeProduct: async (product: ParsedProduct): Promise<string | null> => {
        const identificationPrompt = `Context: Product "${product.title}". Description: "${product.description.substring(0, 500)}".
      Task: Create a prompt for an AI image generator to generate a photorealistic "Action Shot".
      Output ONLY the prompt text.`;

        try {
            const contextResponse = await fetch(`${BACKEND_URL}/api/gemini/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-flash-latest',
                    contents: [{ parts: [{ text: identificationPrompt }] }]
                })
            });
            const contextData = await contextResponse.json();
            const imagePrompt = contextData.text;

            const imageResponse = await fetch(`${BACKEND_URL}/api/gemini/visualize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: { parts: [{ text: imagePrompt }] }
                })
            });
            const imageData = await imageResponse.json();

            if (imageData.image) {
                return `data:image/png;base64,${imageData.image}`;
            }
            return null;
        } catch (e) { throw new Error(AI_ERROR_MSG); }
    },

    processMassOrderAI: async (inputType: 'text' | 'file', textOrFile: string | File): Promise<any> => {
        const prompt = `Analyze this purchase order document.
Extract the order number and all line items (productNumber, productName, quantity, price), and any special instructions.
Respond ONLY with JSON matching this exact schema:
{
  "orderNumber": "string",
  "items": [
    { "productNumber": "string", "productName": "string", "quantity": 1, "price": 10.5 }
  ],
  "specialInstructions": "string"
}`;

        const parts: any[] = [];

        if (inputType === 'file' && textOrFile instanceof File) {
            const base64Data = await fileToBase64(textOrFile);
            const mimeType = getMimeType(textOrFile);
            parts.push({ inlineData: { mimeType, data: base64Data } });
            parts.push({ text: prompt });
        } else {
            parts.push({ text: prompt });
            parts.push({ text: textOrFile as string });
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/gemini/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    contents: [{ role: 'user', parts }],
                    config: { responseMimeType: "application/json" }
                })
            });
            const data = await response.json();
            return JSON.parse(data.text);
        } catch (e) { throw new Error("Could not extract order data. Please try again."); }
    },

    findBestMatchAI: async (item: { productNumber: string, productName?: string }, catalogContextString: string): Promise<string | null> => {
        const prompt = `You are a dental product matching expert. Find the best matching product SKU from the catalog for the given order item.

IMPORTANT matching rules:
- SKU prefixes may differ between brands (e.g., "WP-" for Woodpecker, "xp-" for Xpedent) but the product code after the prefix is the key identifier
- Match by product type, model number, and compatibility system (EMS, Satelec/SAT, KaVo/KAV, NSK)
- A Woodpecker tip "WP-E10D-EMS" should match an Xpedent equivalent "xp-E10D-EMS" if the model number (E10D) and system (EMS) match
- Consider that products may be listed under different brand names but serve the same function
- Only return null if there is truly no comparable product in the catalog

Catalog (format: sku|produktname|marke|hersteller-nr.):
${catalogContextString}

Order item to match:
Product Number: ${item.productNumber}
Product Name: ${item.productName || 'N/A'}

Respond ONLY with JSON: { "matchedSku": "sku_here" } or { "matchedSku": null } if no match exists.`;
        try {
            const response = await fetch(`${BACKEND_URL}/api/gemini/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: { responseMimeType: "application/json" }
                })
            });
            const data = await response.json();
            const res = JSON.parse(data.text);
            return res.matchedSku || null;
        } catch (e) { return null; }
    }
};
