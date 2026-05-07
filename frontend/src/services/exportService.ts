
import JSZip from 'jszip';
import { ParsedProduct, User } from '../types';
import { cleanStringForUrl, parsePrice } from '../utils';
import { CORS_PROXY_URL } from '../config';
import { getAuthHeaders } from './authService';

export const exportService = {
  generateCsvString(products: ParsedProduct[], supplierName: string, idPrefix: string): string {
    if (products.length === 0) return "";
    
    const supplierPrefix = cleanStringForUrl(supplierName);
    const csvHeaders = [ 
        'dentatec_product_number', 'id', 'title', 'description', 'link', 'image_link', 'additional_image_link', 
        'availability', 'price', 'sale_price', 'brand', 'gtin', 'mpn', 'cost_of_goods_sold', 'cogs_calculated', 
        'google_product_category', 'product_type', 'color', 'size', 'material', 'gender', 'age_group', 
        'aiCategory', 'aiColor', 'individualSeoScore', 'individualSeoCategory', 'aiGeneratedDescription',
        'aiRiskScore', 'aiRiskDetails', 'aiImageScore', 'aiImageType', 'aiImageReason'
    ];
    const headerRow = csvHeaders.join(',');
    
    const productRows = products.map(p => {
        return csvHeaders.map(header => {
            let value = '';
            
            if (header === 'dentatec_product_number') {
                const cleanId = cleanStringForUrl(String(p.id));
                value = `${supplierPrefix}-${cleanId}`;
            } else if (header === 'description' && p.aiGeneratedDescription) {
                value = p.aiGeneratedDescription;
            } else {
                value = (p as any)[header];
            }

            if (value === null || value === undefined) value = '';
            if (header === 'id') { value = (idPrefix || '') + String(value); }
            if (header === 'cogs_calculated') { value = p.cogs_calculated ? 'true' : 'false'; }
            
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) { return `"${stringValue.replace(/"/g, '""')}"`; }
            return stringValue;
        }).join(',');
    });
    return [headerRow, ...productRows].join('\n');
  },

  generateXentralCsvString(products: ParsedProduct[], supplierName: string, idPrefix: string): string {
    if (products.length === 0) return "";
    const supplierPrefix = cleanStringForUrl(supplierName);
    const xentralHeaders = [ "nummer", "name_de", "uebersicht_de", "lieferantennummer", "lieferantbestellnummer", "lager_platz", "lagerartikel", "standardlieferant", "hersteller", "projekt", "lieferanteneinkaufnetto", "lieferanteinkaufwaehrung", "lieferanteinkaufmenge", "lieferantlieferzeit_aktuell1", "lieferantlieferzeit_standard1", "lieferantgueltig_bis1", "lieferantpreis_anfrage_vom1", "berechneterek", "berechneterekwaehrung", "verwendeberechneterek", "pseudopreis", "verkaufspreis1netto", "verkaufspreis1menge", "verkaufspreis1waehrung", "verkaufspreis1gueltigab", "verkaufspreis1gueltigbis", "lager_menge_total", "autolagerlampe", "restmenge", "gewicht", "breite", "hoehe", "laenge", "herkunftsland", "freifeld13", "artikelkategorie_name", "artikelbaum1", "artikelbaum2", "freifeld17", "freifeld16", "zolltarifnummer" ];
    const headerRow = xentralHeaders.join(';');
    
    const formatDateYYYYMMDD = (date: Date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${y}-${m}-${d}`;
    };

    const formatDateDDMMYYYY = (date: Date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const rows = products.map(p => {
        const cleanId = cleanStringForUrl(String(p.id));
        const dentatecProductNumber = `${supplierPrefix}-${cleanId}`;
        const cogsNum = parsePrice(p.cost_of_goods_sold) || 0;
        const priceNum = parsePrice(p.price) || 0;
        const salePriceNum = parsePrice(p.sale_price); 
        const netSalesPrice = salePriceNum !== null ? salePriceNum : priceNum;
        const pseudoPrice = priceNum * 1.19;
        const freifeld13Value = cogsNum + 1.15; 

        const formatNumberDe = (num: number) => num.toFixed(2).replace('.', ',');

        const rowData = [
            dentatecProductNumber, p.title || "", p.aiGeneratedDescription || p.description || "", "", (idPrefix || '') + String(p.id), "", "0", "", p.brand || "", "B2B", formatNumberDe(cogsNum), "EUR", "1", "", "", "0000-00-00", formatDateYYYYMMDD(today), formatNumberDe(cogsNum), "EUR", "1", formatNumberDe(pseudoPrice), formatNumberDe(netSalesPrice), "1", "EUR", formatDateDDMMYYYY(yesterday), "00-00-0000", "", "1", "0", "", "", "", "", "", formatNumberDe(freifeld13Value), p.aiCategory || "", "", "", "nein", "B2B", ""
        ];
        return rowData.map(val => {
            const s = String(val);
            if (s.includes(';') || s.includes('"') || s.includes('\n')) { return `"${s.replace(/"/g, '""')}"`; }
            return s;
        }).join(';');
    });
    return [headerRow, ...rows].join('\n');
  },

  async generateImagesZip(products: ParsedProduct[], supplierName: string, onProgress: (msg: string) => void): Promise<Blob | null> {
        const supplierPrefix = cleanStringForUrl(supplierName);
        const zip = new JSZip();
        let successCount = 0;
        const CHUNK_SIZE = 5; 
        const productsWithImages = products.filter(p => p.image_link || p.aiVisualizedImage);
        const total = productsWithImages.length;
        if (total === 0) return null;

        for (let i = 0; i < total; i += CHUNK_SIZE) {
             onProgress(`Downloading/Processing images... ${i} / ${total}`);
             const chunk = productsWithImages.slice(i, i + CHUNK_SIZE);
             await Promise.all(chunk.map(async (p) => {
                 const cleanId = cleanStringForUrl(String(p.id));
                 const dentaTecProductNumber = `${supplierPrefix}-${cleanId}`;
                 const cleanBrand = cleanStringForUrl(p.brand || 'brand');
                 const cleanTitle = cleanStringForUrl(p.title || 'product');
                 
                 // Process original image
                 if (p.image_link) {
                     try {
                        const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(p.image_link)}`;
                        const response = await fetch(proxyUrl, { headers: getAuthHeaders() });
                        if (response.ok) {
                            const blob = await response.blob();
                            let fileNameBase = `${dentaTecProductNumber}-${cleanBrand}-${cleanTitle}`;
                            if (fileNameBase.length > 150) fileNameBase = fileNameBase.substring(0, 150);
                            let ext = '.jpg';
                            if (blob.type === 'image/png') ext = '.png';
                            else if (blob.type === 'image/webp') ext = '.webp';
                            zip.file(`${fileNameBase}${ext}`, blob);
                            successCount++;
                        }
                     } catch (e) { console.warn(`Failed to download image for product ${p.id}`, e); }
                 }

                 // Process AI Generated Image (Action Shot)
                 if (p.aiVisualizedImage) {
                     try {
                         const base64Data = p.aiVisualizedImage.split(',')[1];
                         if (base64Data) {
                             let aiFileName = `${dentaTecProductNumber}-${cleanTitle}-AI-Generated.png`;
                             if (aiFileName.length > 150) {
                                 // truncate but keep suffix
                                 const suffix = "-AI-Generated.png";
                                 aiFileName = `${dentaTecProductNumber}-${cleanTitle}`.substring(0, 150 - suffix.length) + suffix;
                             }
                             zip.file(aiFileName, base64Data, {base64: true});
                             successCount++;
                         }
                     } catch (e) { console.warn(`Failed to add AI image for product ${p.id}`, e); }
                 }
             }));
             await new Promise(resolve => setTimeout(resolve, 10));
        }
        if (successCount === 0) return null;
        onProgress("Compressing images...");
        return await zip.generateAsync({ type: "blob" });
  },

  async uploadToGCS(blob: Blob, filename: string, contentType: string, supplierName: string, onProgress: (msg: string) => void): Promise<void> {
        onProgress(`Uploading ${filename} to cloud storage...`);
        const signUrlEndpoint = "https://data-receiver-320280941237.europe-west3.run.app";
        
        let signResponse;
        try {
            signResponse = await fetch(`${CORS_PROXY_URL}${signUrlEndpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ title: supplierName, filename: filename, contentType: contentType })
            });
        } catch (e: any) {
            throw new Error(`Connection to Signing Service failed: ${e.message}`);
        }

        if (!signResponse.ok) throw new Error(`Signing Service returned status ${signResponse.status}`);
        
        const { signedUrl, debug } = await signResponse.json();
        const requiredContentType = debug?.requiredContentType || contentType;

        let uploadResponse;
        try {
            uploadResponse = await fetch(signedUrl, { 
                method: 'PUT', 
                headers: { 'Content-Type': requiredContentType }, 
                body: blob 
            });
        } catch (e: any) {
            throw new Error(`Connection to Google Cloud Storage failed: ${e.message}`);
        }
        
        if (!uploadResponse.ok) throw new Error(`Upload to Google Cloud failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  },

  async sendEmail(payload: any, onProgress: (msg: string) => void): Promise<void> {
        onProgress("Sending CSV data via email...");
        const emailEndpoint = "https://mailforwarder-320280941237.europe-west1.run.app/";
        
        let response;
        try {
            response = await fetch(`${CORS_PROXY_URL}${emailEndpoint}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(payload)
            });
        } catch (e: any) {
             throw new Error(`Connection to Email Service failed: ${e.message}`);
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Email Service Failed (${response.status}): ${errorText || response.statusText}`);
        }
  },

  async submitOrder(orderData: any): Promise<void> {
      const orderEndpoint = "https://denta-tec-generic-order-importer-320280941237.europe-west3.run.app";
      let response;
      try {
          response = await fetch(`${CORS_PROXY_URL}${orderEndpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(orderData)
          });
      } catch (e: any) {
           throw new Error(`Connection to Order Importer failed: ${e.message}`);
      }

      if (!response.ok) {
          throw new Error(`Order Submission Failed: ${response.status} ${response.statusText}`);
      }
  }
};
