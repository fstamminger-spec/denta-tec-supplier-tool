
import { VIRTUAL_MARKETER_API_KEY } from "../config";

export const optimizationService = {
    async fetchModels(): Promise<{name: string}[]> {
        const response = await fetch("https://api.virtual-marketer.de/api/product", { 
            method: "POST", 
            headers: { 
                "X-AUTH-TOKEN": VIRTUAL_MARKETER_API_KEY, 
                "Content-Type": "application/json" 
            }, 
            body: JSON.stringify({}) 
        });
        if (!response.ok) throw new Error(`Failed to fetch models.`);
        const data = await response.json();
        return data.products.map((name: string) => ({ name }));
    },

    async regenerateDescription(modelName: string, productContext: string): Promise<string> {
        const prompt = `You are an expert in e-commerce SEO. 
        Context: ${productContext}.
        Task: Create a compelling, SEO-optimized product description in HTML format.
        - Highlight key features and benefits.
        - Use a persuasive tone.
        - Include bullet points for readability if appropriate.
        - Ensure it is unique and engaging.
        - Language: German (as per context).
        Generate ONLY the new product description text.`;

        const response = await fetch("https://api.virtual-marketer.de/api/ai", { 
            method: "POST", 
            headers: { 
                "X-AUTH-TOKEN": VIRTUAL_MARKETER_API_KEY, 
                "Content-Type": "application/json" 
            }, 
            body: JSON.stringify({ product: modelName, segment: prompt }) 
        });
        
        if (!response.ok) throw new Error(`API request failed.`);
        const data = await response.json();
        return data[0].text.trim();
    }
};
