
import { DentaTecProduct } from "../types";
import { BACKEND_URL } from "../config";

export const catalogService = {
    async fetchCatalog(forceRefresh = false): Promise<DentaTecProduct[]> {
        if (!forceRefresh) {
            try {
                const cachedCatalog = localStorage.getItem('dentaTecCatalog');
                if (cachedCatalog) {
                    const { timestamp, data } = JSON.parse(cachedCatalog);
                    if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && Array.isArray(data) && data.length > 0) {
                        return data;
                    }
                }
            } catch (e) {
                console.warn("Failed to load catalog from Local Storage:", e);
                localStorage.removeItem('dentaTecCatalog');
            }
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/xentral-catalog`);
            if (!response.ok) throw new Error(`The product catalog service returned an error. Status: ${response.status}.`);

            const catalog: DentaTecProduct[] = await response.json();
            if (!Array.isArray(catalog) || catalog.length === 0) throw new Error("The product catalog was fetched, but it appears to be empty.");

            try {
                localStorage.setItem('dentaTecCatalog', JSON.stringify({
                    timestamp: Date.now(),
                    data: catalog
                }));
            } catch (storageErr) {
                console.warn("Could not save catalog to Local Storage:", storageErr);
            }

            return catalog;
        } catch (e: any) {
            console.error("Error fetching DentaTec catalog:", e.message || e);
            throw e;
        }
    }
};
