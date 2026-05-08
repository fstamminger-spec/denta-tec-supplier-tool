import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from "@google/genai";
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';
import { parse } from 'csv-parse/sync';
import jwt from 'jsonwebtoken';
import { body, param, query, validationResult } from 'express-validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const ALLOWED_ORIGINS = [
    'https://partner.denta-tec.com',
    'https://new-supplier-product-feed-processor-320280941237.us-west1.run.app',
    'https://new-supplier-product-feed-processor-tdbbaepqya-uw.a.run.app',
    'http://localhost:5173',
    'http://localhost:8080',
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
if (!API_KEY) {
    console.error("WARNING: API_KEY is not set in environment variables!");
}

const XENTRAL_FEED_URL = process.env.XENTRAL_FEED_URL || "";
if (!XENTRAL_FEED_URL) {
    console.error("WARNING: XENTRAL_FEED_URL is not set in environment variables!");
}

const VIRTUAL_MARKETER_API_KEY = process.env.VIRTUAL_MARKETER_API_KEY || "";

const AUTH_SECRET = process.env.AUTH_KEY || 'dev-secret';

function handleValidationErrors(req: any, res: any, next: any) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

function requireAuth(req: any, res: any, next: any) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token required' });
    try {
        req.user = jwt.verify(header.slice(7), AUTH_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

const ALLOWED_PROXY_DOMAINS = [
    'xentral.biz',
    'denta-tec-generic-order-importer-320280941237.europe-west3.run.app',
    'data-receiver-320280941237.europe-west3.run.app',
    'mailforwarder-320280941237.europe-west1.run.app',
    'customer-partner-login-320280941237.europe-west3.run.app',
];

const genAI = new GoogleGenAI({ apiKey: API_KEY });
const storage = new Storage();
const BUCKET_NAME = "bi-and-customer-data";

// --- HELPERS ---

async function fetchCSVData(blobName: string): Promise<string> {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(blobName);

    const [dataBytes] = await file.download();

    // Attempt encoding fallbacks similar to Python script
    let text: string;
    try {
        text = dataBytes.toString('utf-8');
    } catch (e) {
        text = dataBytes.toString('latin1');
    }

    // Basic mojibake correction for common German characters if needed
    if (text.includes('Ã') || text.includes('â')) {
        try {
            const corrected = Buffer.from(text, 'latin1').toString('utf8');
            if ((corrected.match(/Ã/g) || []).length < (text.match(/Ã/g) || []).length) {
                text = corrected;
            }
        } catch (e) { }
    }

    return text;
}

function normalizeFieldName(name: string): string {
    if (!name) return "";
    let n = name.trim().toLowerCase();
    if (n.startsWith('"') && n.endsWith('"')) {
        n = n.substring(1, n.length - 1);
    }
    return n;
}

function getFromRowVariants(row: any, variants: string[]): string | null {
    for (const v of variants) {
        if (row[v] !== undefined && row[v] !== null && row[v] !== '') {
            return String(row[v]).trim().replace(/^"|"$/g, '');
        }
        // Also check normalized keys
        for (const k of Object.keys(row)) {
            if (normalizeFieldName(k) === v && row[k] !== undefined && row[k] !== null && row[k] !== '') {
                return String(row[k]).trim().replace(/^"|"$/g, '');
            }
        }
    }
    return null;
}

// --- ENDPOINTS ---

// Login validation
const loginValidation = [
    body('email')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
        .isLength({ max: 254 }).withMessage('Email too long'),
    body('password')
        .isString().withMessage('Password must be a string')
        .isLength({ min: 1, max: 128 }).withMessage('Password must be between 1 and 128 characters')
        .trim(),
    handleValidationErrors
];

app.post('/api/login', loginValidation, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Feld 'email' oder 'password' fehlt." });
    }

    try {
        const csvDataString = await fetchCSVData("customer-data.csv");
        const records = parse(csvDataString, {
            columns: header => header.map((h: string) => normalizeFieldName(h)),
            skip_empty_lines: true,
            trim: true,
            quote: false,
            relax_column_count: true
        });

        const variants = {
            kundennummer: ["kundennummer", "customer_number", "customer id", "kunden_nr"],
            email: ["email", "e-mail", "e mail"],
            name: ["name", "fullname", "vorname nachname"],
            titel: ["titel", "title"],
            straße: ["straße", "strasse", "straÃŸe", "straße?", "straße"],
            plz: ["plz", "postalcode", "zip", "postleitzahl"],
            land: ["land", "country"],
            telefonnummer: ["telefonnummer", "telefon", "phone", "phone_number"],
            firma: ["firma", "company", "unternehmen"],
            anzahl_bestellungen: ["anzahl bestellungen", "anzahl_bestellungen", "orders_count"],
            datum_letzte_bestellung: ["datum der letzten bestellung", "datum_letzte_bestellung", "last_order_date"]
        };

        const searchEmail = email.trim().toLowerCase();
        const searchPassword = password.trim();

        let userFound = null;

        for (const row of records) {
            const csvEmail = getFromRowVariants(row, variants.email);
            if (!csvEmail) continue;

            const csvEmailNorm = csvEmail.toLowerCase();
            if (csvEmailNorm !== searchEmail) continue;

            const csvKundennummer = getFromRowVariants(row, variants.kundennummer);
            const csvPlz = getFromRowVariants(row, variants.plz);

            if (!csvKundennummer || !csvPlz) continue;

            const expectedPassword = `${csvKundennummer}-${csvPlz}`;

            if (expectedPassword === searchPassword) {
                userFound = {
                    kundennummer: csvKundennummer,
                    name: getFromRowVariants(row, variants.name),
                    titel: getFromRowVariants(row, variants.titel),
                    email: csvEmailNorm,
                    straße: getFromRowVariants(row, variants.straße),
                    plz: csvPlz,
                    land: getFromRowVariants(row, variants.land),
                    telefonnummer: getFromRowVariants(row, variants.telefonnummer),
                    firma: getFromRowVariants(row, variants.firma),
                    anzahl_bestellungen: getFromRowVariants(row, variants.anzahl_bestellungen),
                    datum_der_letzten_bestellung: getFromRowVariants(row, variants.datum_letzte_bestellung)
                };
                break;
            }
        }

        if (userFound) {
            const token = jwt.sign(
                { kundennummer: userFound.kundennummer, email: userFound.email },
                AUTH_SECRET,
                { expiresIn: '8h' }
            );
            res.json({ message: "Login successful.", user: userFound, token });
        } else {
            res.status(401).json({ error: "Invalid email or Kundennummer/PLZ combination." });
        }

    } catch (error: any) {
        console.error("Login Error:", error.message);
        res.status(500).json({ error: "Kundendaten konnten nicht abgerufen werden." });
    }
});

// Orders validation
const ordersValidation = [
    body('customer_number')
        .isString().withMessage('customer_number must be a string')
        .isLength({ min: 1, max: 64 }).withMessage('customer_number must be between 1 and 64 characters')
        .trim(),
    handleValidationErrors
];

app.post('/api/orders', requireAuth, ordersValidation, async (req: any, res) => {
    const { customer_number } = req.body;
    if (!customer_number) {
        return res.status(400).json({ error: "Feld 'customer_number' fehlt." });
    }
    if (req.user.kundennummer !== String(customer_number)) {
        return res.status(403).json({ error: "Access denied." });
    }

    try {
        const csvDataString = await fetchCSVData("order_data.csv");
        const records: string[][] = parse(csvDataString, {
            skip_empty_lines: true,
            trim: true,
            quote: false,
            relax_column_count: true
        });

        if (records.length === 0) return res.json([]);

        const headers = records[0].map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const EXCLUDED_FIELDS = ["sales_orders_net_profit", "invoices_net_profit", "deckungsbeitrag"];
        const excludedIndices = headers.map((h, i) => EXCLUDED_FIELDS.includes(h) ? i : -1).filter(i => i !== -1);

        const CUSTOMER_NUMBER_INDEX = 8;
        const searchCustomerNumber = String(customer_number).trim().replace(/^"|"$/g, '');

        const orders = [];
        for (let i = 1; i < records.length; i++) {
            const row = records[i];
            if (row.length > CUSTOMER_NUMBER_INDEX) {
                const csvCustomerNumber = row[CUSTOMER_NUMBER_INDEX].trim().replace(/^"|"$/g, '');
                if (csvCustomerNumber === searchCustomerNumber) {
                    const orderObj: any = {};
                    headers.forEach((h, idx) => {
                        if (!excludedIndices.includes(idx)) {
                            orderObj[h] = row[idx];
                        }
                    });
                    orders.push(orderObj);
                }
            }
        }

        res.json(orders);

    } catch (error: any) {
        console.error("Orders Error:", error.message);
        res.status(500).json({ error: "Bestelldaten konnten nicht abgerufen werden." });
    }
});

// --- XENTRAL CATALOG (NDJSON) ---

let catalogCache: { data: any[]; timestamp: number } | null = null;
const CATALOG_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function parseNdjsonLine(line: string): any | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
}

function mapXentralProduct(raw: any): any {
    const vkNetto = raw['vk netto'] != null ? String(raw['vk netto']) : '';
    const lagerbestand = parseFloat(raw['lagerbestand']) || 0;
    return {
        sku: raw['sku'] || '',
        produktname: raw['bezeichnung'] || '',
        marke: raw['hersteller'] || '',
        'hersteller-nr.': '',
        verkaufbar: lagerbestand > 0 ? 'Ja' : 'Nein',
        'kalkulierter ek': raw['kalk. ek in eur'] != null ? String(raw['kalk. ek in eur']) : '',
        'letzter ek': raw['ek in eur original'] != null ? String(raw['ek in eur original']) : '',
        'letzter vk': vkNetto,
        verkaufspreis: vkNetto,
        lagerbestand: String(lagerbestand),
        projekt: raw['projekt'] || '',
    };
}

app.get('/api/xentral-catalog', requireAuth, async (_req, res) => {
    if (!XENTRAL_FEED_URL) {
        return res.status(500).json({ error: "XENTRAL_FEED_URL is not configured." });
    }

    if (catalogCache && (Date.now() - catalogCache.timestamp < CATALOG_CACHE_TTL)) {
        return res.json(catalogCache.data);
    }

    try {
        const response = await axios.get(XENTRAL_FEED_URL, {
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 60000,
        });

        const lines: string[] = response.data.split('\n');
        const products: any[] = [];

        for (const line of lines) {
            const obj = parseNdjsonLine(line);
            if (!obj) continue;
            if (obj.projekt !== 'Standard') continue;
            if (!obj.sku) continue;
            products.push(mapXentralProduct(obj));
        }

        catalogCache = { data: products, timestamp: Date.now() };
        console.log(`Xentral catalog loaded: ${products.length} products (filtered to projekt=Standard)`);
        res.json(products);
    } catch (error: any) {
        console.error("Xentral catalog fetch error:", error.message);
        if (catalogCache) {
            console.log("Returning stale cache due to fetch error.");
            return res.json(catalogCache.data);
        }
        res.status(500).json({ error: "Failed to fetch Xentral catalog." });
    }
});

function isAllowedPostDomain(targetUrl: string): boolean {
    try {
        const parsed = new URL(targetUrl);
        return ALLOWED_PROXY_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain));
    } catch {
        return false;
    }
}

function isBlockedGetUrl(targetUrl: string): boolean {
    try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
        const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal'];
        if (blocked.includes(parsed.hostname)) return true;
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname)) return true;
        return false;
    } catch {
        return true;
    }
}

// Proxy for Feed URLs to avoid CORS (GET — blocks internal IPs)
// Proxy feed GET validation
const proxyFeedGetValidation = [
    query('url')
        .isString().withMessage('url must be a string')
        .isURL({ require_protocol: true }).withMessage('url must be a valid URL')
        .isLength({ max: 2048 }).withMessage('url too long'),
    handleValidationErrors
];

app.get('/api/proxy-feed', requireAuth, proxyFeedGetValidation, async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL is required");
    if (isBlockedGetUrl(url as string)) return res.status(403).send("URL not allowed");

    try {
        const response = await axios.get(url as string, {
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const contentType = response.headers['content-type'];
        if (typeof contentType === 'string') {
            res.set('Content-Type', contentType);
        }
        res.send(response.data);
    } catch (error: any) {
        console.error("Proxy error:", error.message);
        res.status(500).send("Failed to fetch feed");
    }
});

// Proxy feed POST validation
const proxyFeedPostValidation = [
    query('url')
        .isString().withMessage('url must be a string')
        .isURL({ require_protocol: true }).withMessage('url must be a valid URL')
        .isLength({ max: 2048 }).withMessage('url too long'),
    body().custom(body => {
        if (body === undefined || body === null) return true;
        if (typeof body !== 'object') {
            throw new Error('Request body must be a JSON object');
        }
        return true;
    }),
    handleValidationErrors
];

// Proxy for POST requests (order submission, email, GCS signing — strict domain allowlist)
app.post('/api/proxy-feed', requireAuth, proxyFeedPostValidation, async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("URL is required");
    if (!isAllowedPostDomain(url)) return res.status(403).send("Domain not allowed");

    try {
        const response = await axios.post(url, req.body, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000,
        });
        res.json(response.data);
    } catch (error: any) {
        console.error("Proxy POST error:", error.message);
        const status = error.response?.status || 500;
        const data = error.response?.data || { error: "Proxy request failed" };
        res.status(status).json(data);
    }
});

app.post('/api/virtual-marketer', requireAuth, async (req, res) => {
    const { endpoint, body } = req.body;
    if (!VIRTUAL_MARKETER_API_KEY) return res.status(500).json({ error: "VIRTUAL_MARKETER_API_KEY not configured" });

    const allowedEndpoints = ['/api/product', '/api/ai'];
    if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: "endpoint is required and must be a string" });
    }
    if (!allowedEndpoints.includes(endpoint)) return res.status(403).json({ error: "Endpoint not allowed" });

    try {
        const response = await axios.post(`https://api.virtual-marketer.de${endpoint}`, body, {
            headers: {
                'X-AUTH-TOKEN': VIRTUAL_MARKETER_API_KEY,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        res.json(response.data);
    } catch (error: any) {
        console.error("Virtual Marketer proxy error:", error.message);
        const status = error.response?.status || 500;
        res.status(status).json({ error: "Virtual Marketer request failed" });
    }
});

// --- DEDICATED AI ENDPOINTS (all require auth) ---

// AI extract-order validation
const extractOrderValidation = [
    body('type').optional().isIn(['file', 'text']).withMessage('type must be "file" or "text"'),
    body('text').optional().isString().withMessage('text must be a string').isLength({ max: 100000 }).withMessage('text too long'),
    body('fileBase64').optional().isString().withMessage('fileBase64 must be a string'),
    body('mimeType').optional().isString().withMessage('mimeType must be a string'),
    handleValidationErrors
];

app.post('/api/ai/extract-order', requireAuth, extractOrderValidation, async (req, res) => {
    const { type, text, fileBase64, mimeType } = req.body;
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
    if (type === 'file' && fileBase64) {
        parts.push({ inlineData: { mimeType: mimeType || 'application/pdf', data: fileBase64 } });
        parts.push({ text: prompt });
    } else {
        parts.push({ text: prompt });
        if (text) parts.push({ text });
    }

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts }],
            config: { responseMimeType: "application/json" }
        });
        res.json({ text: result.text });
    } catch (error: any) {
        console.error("Extract order error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/match-product', requireAuth, async (req, res) => {
    const { productNumber, productName, catalogContext } = req.body;
    
    // Input validation
    if (typeof productNumber !== 'string' || productNumber.length === 0 || productNumber.length > 256) {
        return res.status(400).json({ error: 'productNumber must be a non-empty string up to 256 characters' });
    }
    if (productName !== undefined && (typeof productName !== 'string' || productName.length > 1000)) {
        return res.status(400).json({ error: 'productName must be a string up to 1000 characters' });
    }
    if (catalogContext !== undefined && (typeof catalogContext !== 'string' || catalogContext.length > 50000)) {
        return res.status(400).json({ error: 'catalogContext must be a string up to 50000 characters' });
    }

    const prompt = `You are a dental product matching expert. Find the best matching product SKU from the catalog for the given order item.

IMPORTANT matching rules:
- SKU prefixes may differ between brands (e.g., "WP-" for Woodpecker, "xp-" for Xpedent) but the product code after the prefix is the key identifier
- Match by product type, model number, and compatibility system (EMS, Satelec/SAT, KaVo/KAV, NSK)
- A Woodpecker tip "WP-E10D-EMS" should match an Xpedent equivalent "xp-E10D-EMS" if the model number (E10D) and system (EMS) match
- Consider that products may be listed under different brand names but serve the same function
- Only return null if there is truly no comparable product in the catalog

Catalog (format: sku|produktname|marke|hersteller-nr.):
${catalogContext}

Order item to match:
Product Number: ${productNumber}
Product Name: ${productName || 'N/A'}

Respond ONLY with JSON: { "matchedSku": "sku_here" } or { "matchedSku": null } if no match exists.`;

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        res.json({ text: result.text });
    } catch (error: any) {
        console.error("Match product error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/map-headers', requireAuth, async (req, res) => {
    const { headers } = req.body;
    
    // Input validation
    if (!Array.isArray(headers)) {
        return res.status(400).json({ error: 'headers must be an array' });
    }
    if (headers.length > 500) {
        return res.status(400).json({ error: 'headers array too long (max 500)' });
    }
    
    const prompt = `You are an expert in product data and shopping feeds. Analyze the following list of column headers from a supplier file: ${JSON.stringify(headers)}.

Map them to the standard Google Shopping attributes: 'id', 'title', 'description', 'link', 'image_link', 'price', 'brand', 'gtin', 'mpn', 'cost_of_goods_sold'.

Respond ONLY with a single JSON object where keys are the original headers and values are the mapped Google attribute (or null if no match).`;

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        res.json({ text: result.text });
    } catch (error: any) {
        console.error("Map headers error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/optimize-title', requireAuth, async (req, res) => {
    const { title, description, brand } = req.body;
    
    // Input validation
    if (typeof title !== 'string' || title.length === 0 || title.length > 500) {
        return res.status(400).json({ error: 'title must be a non-empty string up to 500 characters' });
    }
    if (description !== undefined && typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string' });
    }
    if (brand !== undefined && (typeof brand !== 'string' || brand.length > 100)) {
        return res.status(400).json({ error: 'brand must be a string up to 100 characters' });
    }
    
    const prompt = `Optimize this product title for Google Shopping SEO (German).
Current Title: "${title}"
Brand: "${brand || ''}"
Context from Description: "${(description || '').substring(0, 500)}..."

Rules:
1. Place strong keywords (Brand, Product Type, Key Feature) at the beginning.
2. Keep it under 150 characters (ideal 70-100).
3. No promotional text (e.g. "Sale", "Best Offer").
4. Return ONLY the new title text.`;

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [{ parts: [{ text: prompt }] }]
        });
        res.json({ text: result.text });
    } catch (error: any) {
        console.error("Optimize title error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/analyze-product', requireAuth, async (req, res) => {
    const { title, description } = req.body;
    
    // Input validation
    if (typeof title !== 'string' || title.length === 0 || title.length > 500) {
        return res.status(400).json({ error: 'title must be a non-empty string up to 500 characters' });
    }
    if (description !== undefined && typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string' });
    }
    
    const prompt = `Analyze product "${title}" & desc "${(description || '').substring(0, 1000)}".
1. Dominant color (or 'Multicolor').
2. Google Product Category string.
3. Risk Score ('Low', 'Medium', 'High').
4. Image CVR style ('Action Shot', 'On Model', 'Flat Lay', '3D Render', 'Product Only', 'Other').
Output JSON.`;

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        res.json({ text: result.text });
    } catch (error: any) {
        console.error("Analyze product error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/visualize-product', requireAuth, async (req, res) => {
    const { title, description } = req.body;
    
    // Input validation
    if (typeof title !== 'string' || title.length === 0 || title.length > 500) {
        return res.status(400).json({ error: 'title must be a non-empty string up to 500 characters' });
    }
    if (description !== undefined && typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string' });
    }
    
    const identificationPrompt = `Context: Product "${title}". Description: "${(description || '').substring(0, 500)}".
Task: Create a prompt for an AI image generator to generate a photorealistic "Action Shot".
Output ONLY the prompt text.`;

    try {
        const contextResult = await genAI.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [{ parts: [{ text: identificationPrompt }] }]
        });
        const imagePrompt = contextResult.text;

        const imageResult = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ parts: [{ text: imagePrompt }] }],
            config: { responseModalities: [Modality.IMAGE] }
        });

        const inlineData = imageResult.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (inlineData?.data) {
            res.json({ image: inlineData.data });
        } else {
            res.status(500).json({ error: "No image generated" });
        }
    } catch (error: any) {
        console.error("Visualize product error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html for all other routes to support SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
