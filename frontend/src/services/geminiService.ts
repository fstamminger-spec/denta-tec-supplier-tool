import { ParsedProduct } from "../types";
import { BACKEND_URL } from "../config";
import { getAuthHeaders } from "./authService";

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
        try {
            const response = await fetch(`${BACKEND_URL}/api/ai/map-headers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ headers: originalHeaders })
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
        try {
            const response = await fetch(`${BACKEND_URL}/api/ai/optimize-title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ title: currentTitle, description, brand })
            });
            const data = await response.json();
            return data.text.trim();
        } catch (e) {
            throw new Error(AI_ERROR_MSG);
        }
    },

    analyzeProductAttributes: async (product: ParsedProduct): Promise<any> => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/ai/analyze-product`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ title: product.title, description: product.description })
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
        try {
            const response = await fetch(`${BACKEND_URL}/api/ai/visualize-product`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ title: product.title, description: product.description })
            });
            const data = await response.json();

            if (data.image) {
                return `data:image/png;base64,${data.image}`;
            }
            return null;
        } catch (e) { throw new Error(AI_ERROR_MSG); }
    },

    processMassOrderAI: async (inputType: 'text' | 'file', textOrFile: string | File): Promise<any> => {
        const body: any = {};

        if (inputType === 'file' && textOrFile instanceof File) {
            body.type = 'file';
            body.fileBase64 = await fileToBase64(textOrFile);
            body.mimeType = getMimeType(textOrFile);
        } else {
            body.type = 'text';
            body.text = textOrFile as string;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/ai/extract-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            return JSON.parse(data.text);
        } catch (e) { throw new Error("Could not extract order data. Please try again."); }
    },

    findBestMatchAI: async (item: { productNumber: string, productName?: string }, catalogContextString: string): Promise<string | null> => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/ai/match-product`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    productNumber: item.productNumber,
                    productName: item.productName,
                    catalogContext: catalogContextString
                })
            });
            const data = await response.json();
            const res = JSON.parse(data.text);
            return res.matchedSku || null;
        } catch (e) { return null; }
    }
};
