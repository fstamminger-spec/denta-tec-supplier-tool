import { ParsedProduct } from "../types";
import { BACKEND_URL } from "../config";

const AI_ERROR_MSG = "AI Service unavailable. Please try again later.";

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
                    model: 'gemini-2.5-flash',
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
                    model: 'gemini-2.5-flash',
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
                    model: 'gemini-2.5-flash',
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
                    model: 'gemini-2.5-flash',
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
        // For simplicity in this granular update, we will handle file uploads in the backend if needed,
        // but for now, text processing is prioritized. 
        const prompt = `Analyze the bulk order input. Extract structured order data.
      Extract: Order number, Line items (productNumber, productName, quantity, price), Special instructions.
      Respond with JSON.`;

        const parts: any[] = [{ text: prompt }];

        if (inputType === 'text') {
            parts.push({ text: textOrFile as string });
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/gemini/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    contents: [{ parts }],
                    config: { responseMimeType: "application/json" }
                })
            });
            const data = await response.json();
            return JSON.parse(data.text);
        } catch (e) { throw new Error("Could not extract order data. Please try again."); }
    },

    findBestMatchAI: async (item: { productNumber: string, productName?: string }, catalogContextString: string): Promise<string | null> => {
        const prompt = `You are a product matching expert. Find best SKU. Catalog: ${catalogContextString}. Item: ${JSON.stringify(item)}. Return JSON { "matchedSku": "..." }`;
        try {
            const response = await fetch(`${BACKEND_URL}/api/gemini/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    contents: [{ parts: [{ text: prompt }] }],
                    config: { responseMimeType: "application/json" }
                })
            });
            const data = await response.json();
            const res = JSON.parse(data.text);
            return res.matchedSku || null;
        } catch (e) { return null; }
    }
};
