
import React, { useState, useMemo, useEffect } from 'react';
import ProductCard from './ProductCard';
import { type ProductQualityScores, type QualityScoreName } from './types';
import FeedAnalysisReport, { type FeedAnalysisData } from './FeedAnalysisReport';
import { analyzeTitle, analyzeDescription, analyzeKeywordDensity } from './qualityChecker';
import * as XLSX from 'xlsx';

// Services
import { authService } from './services/authService';
import { feedService } from './services/feedService';
import { geminiService } from './services/geminiService';
import { catalogService } from './services/catalogService';
import { exportService } from './services/exportService';
import { optimizationService } from './services/optimizationService';

// Hooks
import { useMassOrderLogic } from './hooks/useMassOrderLogic';

// Components
import { Login } from './components/Login';
import { RoleSelector } from './components/RoleSelector';
import { MassOrderReview } from './components/MassOrderReview';
import { OrderConfirmation } from './components/OrderConfirmation';
import { OrderHistory } from './components/OrderHistory';

// Types & Utils
import { ParsedProduct, User, DentaTecProduct, ExtractedOrderItem, ActiveTab, UserRole, InputType, Address } from './types';
import { useLocalStorage, parsePrice, cleanStringForUrl, blobToBase64 } from './utils';
import { GOOGLE_SHOPPING_ATTRIBUTES, DO_NOT_IMPORT_VALUE, MANDATORY_FIELDS, COGS_FIELD_NAME, CORS_PROXY_URL } from './config';

const SpinnerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', marginRight: '5px'}}>
        <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </svg>
);

const INITIAL_PRODUCTS_DISPLAY_COUNT = 50; 
const PRODUCTS_LOAD_INCREMENT = 50;
const BATCH_SIZE = 20;
const ERROR_CONTACT_MSG = "Ein Fehler ist aufgetreten, bitte wende dich an ai@the-platform-group.com falls das wieder passiert.";

const APP_TITLE = "DentaTec Platform Partner Onboarding"; 
const LOGO_URL = "https://denta-tec.com/media/cb/a9/fa/1742548962/Dentatec_Logo_Claim_und_Betty_RGB-without%20spacing.png?ts=1742548962";
const PRIMARY_COLOR = "#00385F";
const SECONDARY_COLOR = "#ED6501";
const TEXT_COLOR_LIGHT = "#FFFFFF";
const TEXT_COLOR_DARK = "#333";
const BORDER_COLOR = "#DDD";
const ERROR_COLOR_TEXT = "#D32F2F";
const ERROR_COLOR_BG = "#FFEBEE";

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userRole, setUserRole] = useLocalStorage<UserRole | null>('userRole', null);
  const [language, setLanguage] = useLocalStorage<'de' | 'en'>('language', 'de');

  const [feedUrl, setFeedUrl] = useLocalStorage('feedUrl', '');
  const [analysisData, setAnalysisData] = useState<FeedAnalysisData | null>(null);
  const [overallFeedSeoScore, setOverallFeedSeoScore] = useState<number | null>(null);
  const [aiOptimizedSeoScore, setAiOptimizedSeoScore] = useState<number | null>(null);
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [productQualityScoresMap, setProductQualityScoresMap] = useState<Map<string, ProductQualityScores>>(new Map());

  const [isLoading, setIsLoading] = useState(false); 
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null); 
  const [error, setError] = useState<string | null>(null);
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [filterMissingAttribute, setFilterMissingAttribute] = useState<string>(''); 
  const [filterSeoQuality, setFilterSeoQuality] = useState<string>('all'); 
  const [activeTab, setActiveTab] = useLocalStorage<ActiveTab>('activeTab', 'feedAnalysis');
  const [inputType, setInputType] = useLocalStorage<InputType>('inputType', 'url');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Header Mapping State
  const [originalFileHeaders, setOriginalFileHeaders] = useState<string[]>([]);
  const [aiHeaderMapping, setAiHeaderMapping] = useState<Record<string, string | null>>({});
  const [currentUserHeaderMapping, setCurrentUserHeaderMapping] = useState<Record<string, string | null>>({});
  const [headerFallbacks, setHeaderFallbacks] = useState<Record<string, string>>({});
  const [rawUploadedData, setRawUploadedData] = useState<{[key: string]: any}[]>([]);
  const [csvDelimiter, setCsvDelimiter] = useState<string | undefined>(undefined);

  // Supplier Config State
  const [legalCompanyName, setLegalCompanyName] = useLocalStorage('legalCompanyName', '');
  const [orderEmail, setOrderEmail] = useLocalStorage('orderEmail', '');
  const [idPrefix, setIdPrefix] = useLocalStorage('idPrefix', '');
  const [orderReceivingMethod, setOrderReceivingMethod] = useLocalStorage<'api' | 'email'>('orderReceivingMethod', 'email');
  const [dentaTecMarginPercent, setDentaTecMarginPercent] = useLocalStorage<number>('dentaTecMarginPercent', 30);

  // Catalog
  const [dentaTecProducts, setDentaTecProducts] = useState<DentaTecProduct[]>([]);
  const [displayedProductsCount, setDisplayedProductsCount] = useState(INITIAL_PRODUCTS_DISPLAY_COUNT);
  
  // Mass Order Logic Hook
  const { 
      step: massOrderStep, setStep: setMassOrderStep,
      items: extractedOrderItems, setItems: setExtractedOrderItems,
      isProcessing: isProcessingMassOrder,
      comment: massOrderComment, setComment: setMassOrderComment,
      externalOrderNumber, setExternalOrderNumber,
      uploadInputType: massOrderInputType, setUploadInputType: setMassOrderInputType,
      processUpload: handleProcessMassOrder,
      updateItem: handleUpdateOrderItem,
      deleteItem: handleDeleteOrderItem,
      addItem: handleAddOrderRow
  } = useMassOrderLogic(dentaTecProducts);

  const [massOrderFile, setMassOrderFile] = useState<File | null>(null);
  const [billingAddress, setBillingAddress] = useState<Address>({ name: '', street: '', zip: '', city: '', country: 'Deutschland' });
  const [shippingAddresses, setShippingAddresses] = useState<Address[]>([]);
  
  // Bulk Optimization States
  const [isBulkOptimizing, setIsBulkOptimizing] = useState(false);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [isBulkVisualizing, setIsBulkVisualizing] = useState(false);

  // Translations Map
  const translationsObj = {
    de: {
        welcomeTitle: "Willkommen im DentaTec Partner Portal", welcomeSubtitle: "Bitte wählen Sie Ihre primäre Rolle, um zu beginnen.", sellerTitle: "Ich bin Verkäufer", sellerDescription: "Greifen Sie auf Werkzeuge zur Analyse von Produkt-Feeds, zur Verwaltung von Lieferantenkonfigurationen und zur Vorbereitung Ihrer Produkte für die DentaTec-Plattform zu.", buyerTitle: "Ich bin Einkäufer", buyerDescription: "Nutzen Sie das Portal, um Sammelbestellungen schnell mittels KI-gestützter Analyse aufzugeben und Ihre Bestellhistorie und den Status zu verfolgen.", welcomeUser: (name: string, role: string) => `Willkommen, ${name} (${role})`, switchToBuyer: "Zum Einkäufer wechseln", switchToSeller: "Zum Verkäufer wechseln", logout: "Abmelden", feedAnalysis: "Feed-Analyse", headerMapping: "Header-Zuordnung", supplierConfig: "Lieferantenkonfiguration", massOrder: "Sammelbestellung", orders: "Bestellungen", dataSource: "Datenquelle:", fetchFromUrl: "Von URL abrufen", uploadFile: "Datei hochladen (CSV/XLSX)", feedUrlLabel: "Google Shopping Feed URL:", processUrl: "URL verarbeiten", uploadProductFile: "Produktdatei hochladen:", processFile: "Datei verarbeiten", selectedFile: (name: string) => `Ausgewählte Datei: ${name}`, dataExport: "Datenexport", downloadProcessedData: "Verarbeitete Daten herunterladen (CSV)", submitData: "Daten an DentaTec übermitteln", productViewer: "Produkt-Ansicht", showingProducts: (visible: number, total: number) => `Zeige ${visible} von ${total} Produkten`, bulkAiActions: "Massen-KI-Aktionen", foundProductsForAi: (count: number) => `Es wurde(n) ${count} Produkt(e) in der aktuellen Ansicht gefunden, die mit KI verbessert werden könnten.`, regenerateAllDescriptions: "Alle Beschreibungen neu generieren", requireAttribute: "Attribut erfordern:", anyAttribute: "Beliebiges Attribut", filterBySeo: "Nach SEO-Qualität filtern:", showAllSeo: "Alle anzeigen (SEO)", excellentGoodSeo: "Exzellent / Gut SEO", fairPoorSeo: "Ausreichend / Schlecht / N/A SEO", excellentOnly: "Nur Exzellent", goodOnly: "Nur Gut", fairOnly: "Nur Ausreichend", poorOnly: "Nur Schlecht", searchPlaceholder: "Produkte nach ID, Titel, Marke, Beschreibung suchen...", search: "Suchen", clearAll: "Alles löschen", noProductsMatch: "Keine Produkte für Ihre aktuellen Such- und Filterkriterien gefunden.", loadMore: "Mehr laden", initialAnalysisPlaceholder: "Wählen Sie eine Datenquelle (URL oder Datei-Upload) und geben Sie die erforderlichen Informationen ein, dann klicken Sie auf 'Verarbeiten', um den Inhalt zu analysieren.", supportError: `Uuups, das hätte nicht passieren sollen. Bitte wenden Sie sich für weiteren Support an Fabian:`, reviewMappingTitle: "Header-Zuordnung prüfen & anpassen", reviewMappingInstructions: "Überprüfen Sie die vorgeschlagene Zuordnung. Überschreiben Sie Vorschläge mit den Dropdowns. Legen Sie Ersatzwerte für leere Daten fest. Wenn mehrere ursprüngliche Header demselben Google-Attribut zugeordnet sind, werden die Werte (oder Ersatzwerte) kombiniert. Die kritischen Felder 'id' und 'title' müssen zugeordnet werden.", originalHeader: "Original-Header", suggestedMapping: "Vorgeschlagene Zuordnung", yourOverride: "Ihre Zuordnung (Google-Attribut)", fallbackValue: "Ersatzwert (wenn leer)", notMapped: "Nicht zugeordnet", doNotImport: "--- Nicht importieren ---", selectAttribute: "--- Attribut auswählen ---", applyMapping: "Zuordnung anwenden & Produkte neu verarbeiten", mappingPlaceholder: "Die Header-Zuordnung ist für Datei-Uploads verfügbar, nachdem eine Datei verarbeitet wurde. Bitte laden Sie eine CSV- oder XLSX-Datei hoch.", supplierConfigTitle: "Lieferantenkonfiguration", legalName: "Offizieller Firmenname:", idPrefix: "Produkt-ID-Präfix (für CSV-Download):", orderMethod: "Bestellempfangsmethode:", byEmail: "Per E-Mail", viaApi: "Über API", orderEmail: "Bestellempfangs-E-Mail:", contactPhone: "Kontakt-Telefonnummer:", marginLabel: "Standard DentaTec-Marge für EK-Berechnung (%):", marginDescription: "Wenn 'cost_of_goods_sold' im Feed fehlt, wird diese Marge verwendet. Wir (DentaTec) nehmen diesen Prozentsatz des Verkaufspreises als unsere Marge. Der Wareneinsatz (was wir Ihnen zahlen) beträgt: Verkaufspreis * (1 - DentaTec-Marge % / 100).", marginFeedbackRecommended: "Empfohlene DentaTec-Marge", cogsCalculation: (value: number) => `Der EK Ihrer Produkte beträgt: Verkaufspreis * ${((100 - value) / 100).toFixed(2)} (d.h. Sie erhalten ${(100 - value).toFixed(2)}% des Verkaufspreises)`, massOrderTitle: "Sammelbestellung", orderSuccessMessage: "Vielen Dank für Ihre Bestellung. Wir senden Ihnen eine Bestätigungs-E-Mail, sobald sie vollständig bearbeitet wurde.", manualOrderSummaryTitle: "Manuell zu bearbeitende Artikel", manualOrderSummaryBody: "Die folgenden Artikel konnten nicht automatisch zugeordnet werden und werden von unserem Team manuell bearbeitet. Dies kann zu einer etwas längeren Lieferzeit für diese Artikel führen. Unser System lernt dazu, um dies in Zukunft zu vermeiden.", massOrderInstructions: "Senden Sie Ihre Bestellung, indem Sie eine Datei hochladen (CSV, XLSX, PDF, Bild) oder den Bestelltext direkt einfügen. Die KI analysiert den Inhalt für Ihre Überprüfung.", pasteText: "Text einfügen", uploadOrderFile: "Bestelldatei hochladen (CSV, XLSX, PDF, Bild):", selectSheet: "Blatt auswählen:", pasteOrderDetails: "Fügen Sie hier Ihre Bestelldetails ein:", analyzing: "Analysiere...", loadingCatalog: "Lade Katalog...", reviewOrderTitle: "Überprüfen und bestätigen Sie Ihre Bestellung", yourOrderNumber: "Ihre Bestellnummer (optional):", reviewInstructions: "Bitte überprüfen Sie die aus Ihrer Einreichung extrahierten Artikel. Sie können jedes Feld bearbeiten. Für nicht zugeordnete Artikel wird unser AI Pro Finder automatisch versuchen, eine Übereinstimmung vorzuschlagen, die Sie bestätigen müssen.", productNumber: "Produktnummer", productName: "Produktname", brand: "Marke", matchedProduct: "Zugeordnetes Produkt (SKU)", quantity: "Menge", pricePerUnit: "Preis (pro Einheit)", actions: "Aktionen", info: "Info", fastDeliveryTooltip: "Der Lagerbestand ist sehr gut. Bestellungen können in der Regel innerhalb von 24 Stunden ausgeliefert werden.", lowStockTooltip: "Niedrige Verfügbarkeit.", veryLowStockTooltip: "Sehr niedrige Verfügbarkeit, hier kann es zu Verzögerungen kommen.", matching: "Suche...", aiSuggestion: "KI-Vorschlag:", accept: "Akzeptieren", reject: "Ablehnen", remove: "Entfernen", addRow: "Zeile hinzufügen", shippingFeesNote: "Bitte beachten Sie: Versandkosten sind nicht enthalten und werden basierend auf der Anzahl der benötigten Pakete berechnet und Ihrer Endrechnung hinzugefügt.", reviewAndConfirm: "Bestellung prüfen & bestätigen", startOver: "Neu beginnen", confirmYourOrder: "Bestätigen Sie Ihre Bestellung", companyName: "Firmenname", streetAndHouseNumber: "Straße & Hausnummer", postalCode: "Postleitzahl", city: "Stadt", country: "Land", cityPlaceholder: "Bitte Stadt eingeben", billingAddress: "Rechnungsadresse", deliveryAddress: "Lieferadresse", deliveryAddresses: "Lieferadressen", addDeliveryAddress: "Weitere Lieferadresse hinzufügen", assignItemsToAddress: "Artikel den Adressen zuweisen", sameAsBilling: "Lieferadresse ist identisch mit Rechnungsadresse", orderComment: "Kommentar zur Bestellung (optional)", orderCommentPlaceholder: "Zusätzliche Anweisungen, z.B. unterschiedliche Lieferadressen...", backToEdit: "Zurück zur Bearbeitung", submitFinalOrder: "Endgültige Bestellung absenden", orderHistory: "Ihre Bestellhistorie", loadingOrders: "Lade Ihre Bestellungen...", noOrdersYet: "Sie haben noch keine Bestellungen aufgegeben.", orderDetails: "Bestelldetails", date: "Datum", netRevenue: "Nettoumsatz", status: "Status", tracking: "Sendungsverfolgung"
    }
  };
  const t = translationsObj[language];

  // Logic -------------------------------------------------------------

  useEffect(() => {
    try {
        const sessionJSON = localStorage.getItem('session');
        if (sessionJSON) {
            const session = JSON.parse(sessionJSON);
            if (session.user && session.expiry && new Date().getTime() < session.expiry) {
                setUser(session.user);
                // Pre-fill billing address from user
                if (!billingAddress.name) {
                    setBillingAddress({
                        name: session.user.name || '',
                        street: session.user.straße || '',
                        zip: session.user.plz || '',
                        city: '',
                        country: session.user.land || 'Deutschland'
                    });
                }
            } else { localStorage.removeItem('session'); }
        }
    } catch (error) { localStorage.removeItem('session'); } finally { setIsAuthLoading(false); }
  }, []);
  
  // Load Catalog on mount or tab switch to Mass Order
  useEffect(() => {
      const loadCatalog = async () => {
          try {
              const catalog = await catalogService.fetchCatalog();
              setDentaTecProducts(catalog);
          } catch (e) { console.error("Failed to load catalog in background", e); }
      };
      if (userRole === 'buyer') loadCatalog();
  }, [userRole]);

  const handleLoginSuccess = (userData: User) => {
    const expiry = new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem('session', JSON.stringify({ user: userData, expiry }));
    setUser(userData);
    if (!localStorage.getItem('legalCompanyName') || localStorage.getItem('legalCompanyName') === '""') {
        setLegalCompanyName(userData.name);
    }
    setBillingAddress({
        name: userData.name || '',
        street: userData.straße || '',
        zip: userData.plz || '',
        city: '',
        country: userData.land || 'Deutschland'
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('session'); localStorage.removeItem('userRole'); setUser(null); setUserRole(null);
  };

  const getNumericScoreCategory = (numericScore: number): QualityScoreName => {
    if (numericScore >= 3.5) return 'Excellent'; if (numericScore >= 2.5) return 'Good'; if (numericScore >= 1.5) return 'Fair'; if (numericScore > 0) return 'Poor'; return 'N/A';
  };
  
  const finalizeProductProcessing = async (initialProducts: ParsedProduct[], feedSourceDetails: Parameters<typeof feedService.analyzeFeedData>[1]) => {
      const CHUNK_SIZE = 200; const totalProducts = initialProducts.length; let finalProducts: ParsedProduct[] = []; const tempQualityScoresMap = new Map<string, ProductQualityScores>(); let totalIndividualSeoScoreSum = 0; let scoredProductsCount = 0; let finalCogsFoundInFeedCount = 0; let finalCogsCalculatedCount = 0;

      for (let i = 0; i < totalProducts; i += CHUNK_SIZE) {
          const progress = i + CHUNK_SIZE > totalProducts ? totalProducts : i + CHUNK_SIZE; setLoadingMessage(`Processing products... ${progress} / ${totalProducts}`); await new Promise(resolve => setTimeout(resolve, 0));
          const chunk = initialProducts.slice(i, i + CHUNK_SIZE);
          chunk.forEach(p => {
              const productCopy = { ...p };
              if ((!productCopy.cost_of_goods_sold || String(productCopy.cost_of_goods_sold).trim() === "") && !productCopy.cogs_calculated) {
                  const numericPrice = parsePrice(productCopy.price);
                  if (numericPrice !== null && numericPrice > 0 && dentaTecMarginPercent >= 5 && dentaTecMarginPercent <= 100) {
                      const cogsValue = numericPrice * (1 - dentaTecMarginPercent / 100); productCopy.cost_of_goods_sold = cogsValue.toFixed(2); productCopy.cogs_calculated = true;
                  }
              }
              if (productCopy.cost_of_goods_sold && String(productCopy.cost_of_goods_sold).trim() !== '') { if (productCopy.cogs_calculated) finalCogsCalculatedCount++; else finalCogsFoundInFeedCount++; }
              const scores = { title: analyzeTitle(productCopy.title || ""), description: analyzeDescription(productCopy.description || ""), keywords: analyzeKeywordDensity(productCopy.title || "", productCopy.description || "") };
              tempQualityScoresMap.set(productCopy.id, scores);
              const titleScore = scores.title.numericScore * 0.4; const descScore = scores.description.numericScore * 0.3; const keywordScore = scores.keywords.numericScore * 0.3; const individualProductScore = titleScore + descScore + keywordScore;
              productCopy.individualSeoScore = individualProductScore; productCopy.individualSeoCategory = getNumericScoreCategory(individualProductScore);
              if (individualProductScore > 0) { totalIndividualSeoScoreSum += individualProductScore; scoredProductsCount++; }
              finalProducts.push(productCopy);
          });
      }
      const finalCogsCounts = { foundInFeed: finalCogsFoundInFeedCount, calculated: finalCogsCalculatedCount };
      const report = feedService.analyzeFeedData(finalProducts, feedSourceDetails, finalCogsCounts, currentUserHeaderMapping);
      setAnalysisData(report); setProducts(finalProducts); setProductQualityScoresMap(tempQualityScoresMap);
      if (scoredProductsCount > 0) { setOverallFeedSeoScore(((totalIndividualSeoScoreSum / scoredProductsCount) / 4) * 100); } else if (finalProducts.length > 0) { setOverallFeedSeoScore(0); } else { setOverallFeedSeoScore(null); }
  };

  // ... (URL and File Processing Handlers remain same) ...
  const handleProcessUrlFeed = async () => {
    if (!feedUrl.trim()) { setError("Please enter a Google Shopping Feed URL."); resetStateForNewProcess(); setUploadedFile(null); setUploadedFileName(''); return; }
    try { new URL(feedUrl); } catch (_) { setError("The entered URL is not valid."); resetStateForNewProcess(); return; }
    setIsLoading(true); setLoadingMessage("Fetching and analyzing feed from URL..."); resetStateForNewProcess(); setUploadedFile(null); setUploadedFileName('');
    try {
        const proxyUrl = `${CORS_PROXY_URL}${encodeURIComponent(feedUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Failed to fetch feed. Status: ${response.status}`);
        const rawText = await response.text();
        const contentType = response.headers.get('Content-Type');
        const isLikelyXml = contentType?.toLowerCase().includes('xml') || rawText.trim().startsWith('<');
        let localParsedProducts: ParsedProduct[] = [];
        let feedSourceDetails: any = { type: 'URL', name: feedUrl, isXml: isLikelyXml };
        
        if (isLikelyXml) {
             try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(rawText, "application/xml");
                if (xmlDoc.querySelector("parsererror")) throw new Error("Invalid XML structure.");
                const gNamespace = "http://base.google.com/ns/1.0";
                const xmlNamespaceDetected = rawText.includes(`xmlns:g="${gNamespace}"`) || xmlDoc.documentElement.getAttribute("xmlns:g") === gNamespace;
                const items = [...Array.from(xmlDoc.getElementsByTagName("item")), ...Array.from(xmlDoc.getElementsByTagName("entry")), ...Array.from(xmlDoc.getElementsByTagName("product"))];
                feedSourceDetails.xmlItemCount = { items: xmlDoc.getElementsByTagName("item").length, entries: xmlDoc.getElementsByTagName("entry").length, products: xmlDoc.getElementsByTagName("product").length };
                feedSourceDetails.xmlNamespaceDetected = xmlNamespaceDetected;
                items.forEach(el => {
                   const product: ParsedProduct = { id: feedService.getProductAttribute(el, 'id', xmlNamespaceDetected ? gNamespace : null), title: feedService.getProductAttribute(el, 'title', xmlNamespaceDetected ? gNamespace : null), brand: feedService.getProductAttribute(el, 'brand', xmlNamespaceDetected ? gNamespace : null), description: feedService.getProductAttribute(el, 'description', xmlNamespaceDetected ? gNamespace : null), image_link: feedService.getProductAttribute(el, 'image_link', xmlNamespaceDetected ? gNamespace : null), price: feedService.getProductAttribute(el, 'price', xmlNamespaceDetected ? gNamespace : null), gtin: feedService.getProductAttribute(el, 'gtin', xmlNamespaceDetected ? gNamespace : null), mpn: feedService.getProductAttribute(el, 'mpn', xmlNamespaceDetected ? gNamespace : null), cost_of_goods_sold: feedService.getProductAttribute(el, COGS_FIELD_NAME, xmlNamespaceDetected ? gNamespace : null) };
                   if (product.id && product.title) localParsedProducts.push(product);
                });
             } catch(e) {
                 const csvRes = feedService.parseAsCsvFull(rawText);
                 if (!csvRes.error && csvRes.rawData && csvRes.rawData.length > 0) {
                     localParsedProducts = csvRes.rawData.map(r => { const p: any = {id:'',title:''}; for(const k in r) p[k]=r[k]; return p as ParsedProduct; }).filter(p => p.id && p.title);
                     feedSourceDetails = { ...feedSourceDetails, isXml: false, headers: csvRes.headers, delimiter: csvRes.delimiter };
                 } else throw e;
             }
        } else {
             const csvRes = feedService.parseAsCsvFull(rawText);
             if (csvRes.error) throw new Error(csvRes.error);
             localParsedProducts = (csvRes.rawData || []).map(r => { const p: any = {id:'',title:''}; for(const k in r) p[k.toLowerCase().replace(/\s+/g,'_')] = r[k]; return p as ParsedProduct; }).filter(p => p.id && p.title);
             feedSourceDetails = { ...feedSourceDetails, isXml: false, headers: csvRes.headers, delimiter: csvRes.delimiter };
        }
        await finalizeProductProcessing(localParsedProducts, feedSourceDetails);
    } catch (e: any) { setError(e.message); resetStateForNewProcess(); } finally { setIsLoading(false); setLoadingMessage(null); }
  };

  const handleProcessFileUpload = async () => {
      if (!uploadedFile) { setError("No file selected."); return; }
      setIsLoading(true); resetStateForNewProcess(); setUploadedFile(uploadedFile); setUploadedFileName(uploadedFile.name); setLoadingMessage("Processing uploaded file...");
      try {
          const reader = new FileReader();
          reader.onload = async (e) => {
              const fileContent = e.target?.result;
              let localRawData: any[] = []; let localHeaders: string[] = []; let localDelimiter: string | undefined;
              if (uploadedFile.name.endsWith('.csv')) {
                   const text = typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent as ArrayBuffer);
                   const res = feedService.parseAsCsvFull(text);
                   localRawData = res.rawData || []; localHeaders = res.headers || []; localDelimiter = res.delimiter;
              } else {
                  const workbook = XLSX.read(fileContent, { type: 'array' });
                  const sheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[sheetName];
                  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                  if (jsonData.length > 0) {
                      localHeaders = jsonData[0].map(String);
                      localRawData = jsonData.slice(1).map(row => { const obj:any={}; localHeaders.forEach((h,i) => obj[h] = row[i]); return obj; });
                  }
              }
              setRawUploadedData(localRawData); setOriginalFileHeaders(localHeaders); setCsvDelimiter(localDelimiter);
              
              const storedMappingJson = localStorage.getItem(`headerMapping-${uploadedFile.name}`);
              let mapping: any = {}, fallbacks: any = {};
              if (storedMappingJson) { const d = JSON.parse(storedMappingJson); mapping = d.mapping; fallbacks = d.fallbacks; }
              else { mapping = await geminiService.getGoogleShoppingHeaderMapping(localHeaders); }
              
              if (!Object.values(mapping).includes('id')) { const match = localHeaders.find(h => ['id','sku','artikelnummer'].includes(h.toLowerCase())); if(match) mapping[match] = 'id'; }
              if (!Object.values(mapping).includes('title')) { const match = localHeaders.find(h => ['title','name','bezeichnung'].includes(h.toLowerCase())); if(match) mapping[match] = 'title'; }
              
              setAiHeaderMapping(mapping); setCurrentUserHeaderMapping({...mapping}); 
              localHeaders.forEach(h => { if (!fallbacks[h]) fallbacks[h] = ''; }); setHeaderFallbacks(fallbacks);

              if (!Object.values(mapping).includes('id') || !Object.values(mapping).includes('title')) {
                  setError("Critical fields 'id' and 'title' could not be mapped automatically. Please configure manually."); setActiveTab('headerMapping'); setIsLoading(false); return;
              }
              const transformed = feedService.applyHeaderMapping(localRawData, mapping, fallbacks, localHeaders);
              const fileType = uploadedFile.name.endsWith('.csv') ? 'CSV' : 'XLSX';
              await finalizeProductProcessing(transformed, { type: fileType, name: uploadedFile.name, headers: localHeaders, delimiter: localDelimiter });
              if (transformed.length > 0) setActiveTab('feedAnalysis');
              setIsLoading(false); setLoadingMessage(null);
          };
          if (uploadedFile.name.endsWith('.csv')) reader.readAsText(uploadedFile); else reader.readAsArrayBuffer(uploadedFile);
      } catch (err: any) { setError(err.message); setIsLoading(false); }
  };

  const handleApplyHeaderMapping = async () => {
      setIsLoading(true);
      const transformed = feedService.applyHeaderMapping(rawUploadedData, currentUserHeaderMapping, headerFallbacks, originalFileHeaders);
      const fileType = uploadedFile!.name.endsWith('.csv') ? 'CSV' : 'XLSX';
      await finalizeProductProcessing(transformed, { type: fileType, name: uploadedFile!.name, headers: originalFileHeaders, delimiter: csvDelimiter });
      setIsLoading(false); setActiveTab('feedAnalysis');
  };

  // ... (Other handlers) ...
  const handleAnalyzeProductAttributes = async (productId: string) => {
      const p = products.find(prod => prod.id === productId); if (!p) return;
      setProducts(prev => prev.map(prod => prod.id === productId ? { ...prod, isAiAnalysisLoading: true } : prod));
      try {
          const result = await geminiService.analyzeProductAttributes(p);
          setProducts(prev => prev.map(prod => prod.id === productId ? { ...prod, ...result, isAiAnalysisLoading: false } : prod));
      } catch (e: any) { setProducts(prev => prev.map(prod => prod.id === productId ? { ...prod, aiError: e.message, isAiAnalysisLoading: false } : prod)); }
  };
  
  const handleVisualizeProduct = async (productId: string) => {
      const p = products.find(prod => prod.id === productId); if (!p) return;
      setProducts(prev => prev.map(prod => prod.id === productId ? { ...prod, isAiVisualizationLoading: true } : prod));
      try {
          const base64 = await geminiService.visualizeProduct(p);
          setProducts(prev => prev.map(prod => prod.id === productId ? { ...prod, aiVisualizedImage: base64 || undefined, isAiVisualizationLoading: false } : prod));
      } catch (e: any) { setProducts(prev => prev.map(prod => prod.id === productId ? { ...prod, aiError: e.message, isAiVisualizationLoading: false } : prod)); }
  };

  // Helper function to update products state
  const updateProductState = (id: string, updates: Partial<ParsedProduct>) => {
      setProducts(prev => prev.map(prod => prod.id === id ? { ...prod, ...updates } : prod));
  };

  const handleBulkOptimizeDescriptions = async () => {
      setIsBulkOptimizing(true);
      const productsToOptimize = allFilteredProducts.filter(p => !p.aiGeneratedDescription); 
      const total = productsToOptimize.length;
      let count = 0;
      
      const models = await optimizationService.fetchModels();
      const defaultModel = 'dentatec_Produktbeschreibung-HTML_Deutsch';
      const modelName = models.some((m: any) => m.name === defaultModel) ? defaultModel : models[0]?.name || '';

      if (!modelName) {
          alert("Could not load AI model for optimization.");
          setIsBulkOptimizing(false);
          return;
      }

      for (let i = 0; i < total; i += BATCH_SIZE) {
          const batch = productsToOptimize.slice(i, i + BATCH_SIZE);
          try {
              await Promise.all(batch.map(async (product) => {
                  const context = `Product: ${product.title}. Description: ${product.description}`;
                  const newText = await optimizationService.regenerateDescription(modelName, context);
                  setProducts(prev => prev.map(prod => prod.id === product.id ? { ...prod, aiGeneratedDescription: newText } : prod));
              }));
              count += batch.length;
              setLoadingMessage(`Optimizing descriptions (Enterprise API)... ${count} / ${total}`);
          } catch (e) {
              console.error(`Bulk Optimization Batch Error:`, e);
              setError(ERROR_CONTACT_MSG);
              setIsBulkOptimizing(false);
              setLoadingMessage(null);
              return; 
          }
      }
      setIsBulkOptimizing(false);
      setLoadingMessage(null);
  };

  const handleBulkAnalyzeAttributes = async () => {
      setIsBulkAnalyzing(true);
      const productsToAnalyze = allFilteredProducts.filter(p => !p.aiCategory);
      const total = productsToAnalyze.length;
      let count = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
          const batch = productsToAnalyze.slice(i, i + BATCH_SIZE);
          try {
              // Update state to loading for this batch
              setProducts(prev => prev.map(p => batch.find(b => b.id === p.id) ? { ...p, isAiAnalysisLoading: true } : p));
              
              const results = await Promise.all(batch.map(async (product) => {
                  try {
                      const res = await geminiService.analyzeProductAttributes(product);
                      return { id: product.id, data: res, error: null };
                  } catch (e: any) {
                      return { id: product.id, data: null, error: e.message };
                  }
              }));

              setProducts(prev => prev.map(p => {
                  const res = results.find(r => r.id === p.id);
                  if (res) {
                      return { ...p, ...(res.data || {}), aiError: res.error, isAiAnalysisLoading: false };
                  }
                  return p;
              }));
              count += batch.length;
              setLoadingMessage(`Analyzing attributes... ${count} / ${total}`);
          } catch (e) {
              console.error(`Bulk Attribute Analysis Error:`, e);
              setError(ERROR_CONTACT_MSG);
              setIsBulkAnalyzing(false);
              setLoadingMessage(null);
              return;
          }
      }
      setIsBulkAnalyzing(false);
      setLoadingMessage(null);
  };

  const handleBulkVisualizeProducts = async () => {
      setIsBulkVisualizing(true);
      const productsToVisualize = allFilteredProducts.filter(p => !p.aiVisualizedImage);
      const total = productsToVisualize.length;
      let count = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
          const batch = productsToVisualize.slice(i, i + BATCH_SIZE);
          try {
              setProducts(prev => prev.map(p => batch.find(b => b.id === p.id) ? { ...p, isAiVisualizationLoading: true } : p));

              const results = await Promise.all(batch.map(async (product) => {
                  try {
                      const base64 = await geminiService.visualizeProduct(product);
                      return { id: product.id, image: base64, error: null };
                  } catch (e: any) {
                      return { id: product.id, image: null, error: e.message };
                  }
              }));

              setProducts(prev => prev.map(p => {
                  const res = results.find(r => r.id === p.id);
                  if (res) {
                      return { ...p, aiVisualizedImage: res.image || undefined, aiError: res.error, isAiVisualizationLoading: false };
                  }
                  return p;
              }));
              count += batch.length;
              setLoadingMessage(`Generating Action Shots... ${count} / ${total}`);
          } catch (e) {
              console.error(`Bulk Visualization Error:`, e);
              setError(ERROR_CONTACT_MSG);
              setIsBulkVisualizing(false);
              setLoadingMessage(null);
              return;
          }
      }
      setIsBulkVisualizing(false);
      setLoadingMessage(null);
  };
  
  // --- Export Handlers ---
  const handleDownloadCsv = () => {
    if (products.length === 0) return;
    const csvString = exportService.generateCsvString(products, legalCompanyName, idPrefix);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `processed_products_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitData = async () => {
    if (!legalCompanyName || !orderEmail) {
        const missing = [];
        if (!legalCompanyName) missing.push(t.legalName);
        if (!orderEmail) missing.push(t.orderEmail);
        const errorMsg = `Bitte vervollständigen Sie die Lieferantenkonfiguration: ${missing.join(', ')} fehlt.`;
        setError(errorMsg);
        setActiveTab('supplierConfig');
        window.scrollTo(0, 0);
        return;
    }
    
    setIsExporting(true);
    setExportMessage("Generiere Daten & Bilder...");
    
    try {
        const xentralCsv = exportService.generateXentralCsvString(products, legalCompanyName, idPrefix);
        const csvBlob = new Blob([xentralCsv], { type: 'text/csv;charset=utf-8;' });
        const csvBase64 = await blobToBase64(csvBlob);
        
        const timestamp = new Date().getTime();
        const safeCompanyName = cleanStringForUrl(legalCompanyName);
        const csvFilename = `${safeCompanyName}_${timestamp}.csv`;
        
        // Upload CSV
        await exportService.uploadToGCS(csvBlob, csvFilename, 'text/csv', legalCompanyName, setExportMessage);
        
        let zipUrl = '';
        const zipBlob = await exportService.generateImagesZip(products, legalCompanyName, setExportMessage);
        if (zipBlob) {
            const zipFilename = `${safeCompanyName}_images_${timestamp}.zip`;
            await exportService.uploadToGCS(zipBlob, zipFilename, 'application/zip', legalCompanyName, setExportMessage);
            zipUrl = `https://storage.googleapis.com/denta-tec-data-bucket/${zipFilename}`; 
        }
        
        const csvUrl = `https://storage.googleapis.com/denta-tec-data-bucket/${csvFilename}`;
        
        // 1. Email to User (Confirmation)
        setExportMessage("Sende Bestätigung an Benutzer...");
        await exportService.sendEmail({
            to: orderEmail,
            subject: `Eingangsbestätigung: ${legalCompanyName}`,
            content: `Vielen Dank! Ihre Produktdaten (${products.length} Artikel) wurden erfolgreich zur Prüfung eingereicht.\n\nWir melden uns in Kürze.`
        }, () => {});

        // 2. Email to Tim (Notification)
        setExportMessage("Informiere Tim...");
        await exportService.sendEmail({
            to: "tim.pfeiffer@denta-tec.com",
            subject: `Review: Neue Produkte von ${legalCompanyName}`,
            content: `${products.length} Produkte wurden von ${legalCompanyName} erfolgreich zur Prüfung eingereicht.\nMethode: ${orderReceivingMethod}`
        }, () => {});

        // 3. Email to Marketing (Data + CSV Attachment)
        setExportMessage("Sende Daten an Marketing...");
        await exportService.sendEmail({
            to: "marketing@denta-tec.com",
            subject: `Daten-Export: ${legalCompanyName}`,
            content: `
                Lieferant: ${legalCompanyName}
                Email: ${orderEmail}
                Produkte: ${products.length}
                
                CSV Link: ${csvUrl}
                Bilder Link: ${zipUrl || "Keine Bilder"}
            `,
            attachment_data: csvBase64,
            attachment_filename: csvFilename
        }, () => {});

        setExportMessage("Erfolgreich übermittelt!");
        alert("Daten wurden erfolgreich an DentaTec übermittelt.");
        
    } catch (e: any) {
        setExportMessage(`Fehler: ${e.message}`);
        console.error(e);
        alert(`Ein Fehler ist aufgetreten: ${e.message}`);
    } finally {
        setIsExporting(false);
    }
  };

  const handleFinalSubmitOrder = async (comment: string) => {
      if (!user) return;
      
      try {
          // Group items by shipping address index
          const orderGroups = new Map<number, ExtractedOrderItem[]>();
          extractedOrderItems.forEach(item => {
              const idx = item.shippingAddressIndex || 0;
              if (!orderGroups.has(idx)) orderGroups.set(idx, []);
              orderGroups.get(idx)!.push(item);
          });

          const timestamp = Date.now();
          
          // Use External Order Number if available, else standard timestamp logic
          const externalOrderBase = externalOrderNumber ? externalOrderNumber : `${timestamp}`;

          // Iterate through each group (delivery address) and send separate orders
          for (const [addressIndex, items] of orderGroups) {
              const address = shippingAddresses[addressIndex] || billingAddress;
              
              // Only matched items go into the OrderPositionList
              const matchedItems = items.filter(i => i.matchedSku && i.matchedProduct);
              const unmatchedItems = items.filter(i => !i.matchedSku || !i.matchedProduct);

              const POSTAGE = 6.90;
              let netAmount = 0;
              
              const orderItemsPayload = matchedItems.map(item => {
                  // Ensure price is a number
                  const price = typeof item.matchedProduct?.verkaufspreis === 'number' 
                      ? item.matchedProduct.verkaufspreis 
                      : parsePrice(item.matchedProduct?.verkaufspreis || item.price) || 0;
                  
                  const totalLine = price * item.quantity;
                  netAmount += totalLine;

                  return {
                      ProductName: item.matchedProduct?.produktname || item.productName || "Unknown Product",
                      SKU: item.matchedSku,
                      OrderQuantity: item.quantity,
                      UnitPrice: price,
                      TotalPrice: totalLine,
                      VatType: "Standard",
                      Remark: "", // Set to empty as requested (Freitext...unnötig)
                      ProductId: item.matchedProduct?.['produkt id'] || "",
                      EAN: item.matchedProduct?.gtin || ""
                  };
              });

              // Add postage to net
              netAmount += POSTAGE;
              const grossAmount = netAmount * 1.19;

              // Construct the prefixed order number
              // If there are multiple shipping addresses, we must append index to keep them unique in backend
              const finalOrderNumber = orderGroups.size > 1 
                  ? `Grosshandel-${externalOrderBase}-${addressIndex}`
                  : `Grosshandel-${externalOrderBase}`;

              // Receipt Text (Kopftext) - Should contain only the external order number as per requirement
              // Freitext fields should be clean.
              let receiptText = externalOrderNumber || ""; 
              
              const payload = {
                  OrderNumber: finalOrderNumber,
                  OrderToken: `WEB-${timestamp}-${addressIndex}`, // Use generated token if not strictly provided
                  CreateDate: new Date().toISOString(),
                  Currency: "EUR",
                  CustomerNumber: user.kundennummer,
                  GrossAmount: parseFloat(grossAmount.toFixed(2)),
                  NetAmount: parseFloat(netAmount.toFixed(2)),
                  Postage: POSTAGE,
                  PaymentType: "Rechnung", 
                  ReceiptText: receiptText, // Mapped to Kopftext
                  BillingAddress: {
                      AddressId: `B-${user.kundennummer}`,
                      BuyerTypeId: "Business",
                      Name1: billingAddress.name,
                      Name2: "",
                      Line1: billingAddress.street,
                      Line2: "",
                      City: billingAddress.city,
                      PostCode: billingAddress.zip,
                      CountryIsoCode2: "DE",
                      Email: user.email,
                      Phone1: user.telefonnummer || ""
                  },
                  DeliveryAddress: {
                      AddressId: `D-${user.kundennummer}-${addressIndex}`,
                      BuyerTypeId: "Business",
                      Name1: address.name,
                      Name2: "",
                      Line1: address.street,
                      Line2: "",
                      City: address.city,
                      PostCode: address.zip,
                      CountryIsoCode2: "DE",
                      Email: user.email,
                      Phone1: user.telefonnummer || ""
                  },
                  OrderPositionList: {
                      Items: orderItemsPayload
                  }
              };

              // Submit to backend
              await exportService.submitOrder(payload);
          }

          setMassOrderStep('success');
      } catch (e: any) {
          alert(`Submission failed: ${e.message}`);
      } finally {
          // setIsProcessingMassOrder(false); // Handled by hook logic mainly, but needed if error
      }
  };

  const resetStateForNewProcess = () => { setError(null); setAnalysisData(null); setProducts([]); setProductQualityScoresMap(new Map()); setOverallFeedSeoScore(null); setAiOptimizedSeoScore(null); setActiveSearchTerm(''); setSearchTerm(''); setFilterMissingAttribute(''); setFilterSeoQuality('all'); setLoadingMessage(null); setOriginalFileHeaders([]); setAiHeaderMapping({}); setCurrentUserHeaderMapping({}); setHeaderFallbacks({}); setRawUploadedData([]); setCsvDelimiter(undefined); };

  // Styles (retaining original style object logic but condensed)
  const styles: { [key: string]: React.CSSProperties } = {
    appContainer: { fontFamily: "'Inter', sans-serif", color: TEXT_COLOR_DARK, minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' },
    // STICKY HEADER CHANGE
    header: { backgroundColor: PRIMARY_COLOR, color: TEXT_COLOR_LIGHT, padding: '20px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', position: 'sticky', top: 0, zIndex: 1000 },
    headerLeft: { display: 'flex', alignItems: 'center' }, headerRight: { display: 'flex', alignItems: 'center', gap: '20px' },
    userInfo: { fontSize: '0.95em', fontWeight: '500', display: 'flex', alignItems: 'center' },
    roleSwitchButton: { backgroundColor: SECONDARY_COLOR, color: TEXT_COLOR_LIGHT, border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '0.9em', fontWeight: 'bold', cursor: 'pointer' },
    logoutButton: { backgroundColor: 'transparent', color: TEXT_COLOR_LIGHT, border: `2px solid ${TEXT_COLOR_LIGHT}`, borderRadius: '6px', padding: '8px 16px', fontSize: '0.9em', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    logoWrapper: { backgroundColor: '#FFFFFF', padding: '8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '20px' },
    logo: { height: '50px', display: 'block' }, title: { margin: 0, fontSize: '1.8em', fontWeight: '600' },
    // STICKY TABS CHANGE (Added sticky position and top offset)
    tabContainer: { display: 'flex', justifyContent: 'center', backgroundColor: '#e9ecef', padding: '10px 0', boxShadow: 'inset 0 -2px 5px -2px rgba(0,0,0,0.1)', position: 'sticky', top: '90px', zIndex: 990 },
    tabButton: { padding: '12px 25px', fontSize: '1.1em', fontWeight: '500', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: PRIMARY_COLOR, borderBottom: '3px solid transparent', display: 'flex', alignItems: 'center', gap: '10px' },
    activeTabButton: { color: SECONDARY_COLOR, borderBottom: `3px solid ${SECONDARY_COLOR}`, fontWeight: '600' },
    mainContent: { flexGrow: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px' },
    card: { backgroundColor: TEXT_COLOR_LIGHT, padding: '20px 25px', borderRadius: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.07)', width: '100%', maxWidth: '1100px', boxSizing: 'border-box' },
    // GRID CONTAINER FOR PRODUCTS
    productGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', width: '100%', maxWidth: '1400px' },
    label: { display: 'block', marginBottom: '10px', fontWeight: '600', fontSize: '1.05em', color: PRIMARY_COLOR },
    input: { width: '100%', padding: '12px 15px', marginBottom: '20px', border: `1px solid ${BORDER_COLOR}`, borderRadius: '6px', fontSize: '1em', boxSizing: 'border-box' },
    button: { backgroundColor: SECONDARY_COLOR, color: TEXT_COLOR_LIGHT, padding: '12px 25px', border: 'none', borderRadius: '6px', fontSize: '1.05em', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minWidth: '150px' },
    buttonDisabled: { backgroundColor: '#BDBDBD', cursor: 'not-allowed' },
    errorMessage: { color: ERROR_COLOR_TEXT, backgroundColor: ERROR_COLOR_BG, border: `1px solid ${ERROR_COLOR_TEXT}`, padding: '15px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.9em' },
    contentTitle: { color: PRIMARY_COLOR, marginTop: '0', marginBottom: '20px', borderBottom: `3px solid ${SECONDARY_COLOR}`, paddingBottom: '12px', fontSize: '1.6em' },
    mappingTable: { width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '0.9em' },
    mappingTableHeader: { textAlign: 'left', padding: '12px 15px', borderBottom: `2px solid ${PRIMARY_COLOR}`, backgroundColor: '#f8f9fa', color: PRIMARY_COLOR, fontWeight: '600' },
    mappingTableCell: { padding: '16px 15px', borderBottom: `1px solid ${BORDER_COLOR}`, verticalAlign: 'middle' },
    mappingSelect: { width: '100%', padding: '8px', borderRadius: '4px', border: `1px solid ${BORDER_COLOR}` },
    footer: { backgroundColor: TEXT_COLOR_DARK, color: '#BDBDBD', textAlign: 'center', padding: '25px', fontSize: '0.9em', marginTop: 'auto' },
    // Filter controls style
    filterControls: { display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' },
    filterSelect: { padding: '8px 12px', borderRadius: '6px', border: `1px solid ${BORDER_COLOR}`, minWidth: '200px' }
  };

  const allFilteredProducts = useMemo(() => {
    let tempProducts = [...products];
    if (filterMissingAttribute) tempProducts = tempProducts.filter(p => p[filterMissingAttribute] && String(p[filterMissingAttribute]).trim() !== '');
    if (filterSeoQuality !== 'all') {
        tempProducts = tempProducts.filter(p => {
            const score = p.individualSeoScore;
            if (filterSeoQuality === 'excellent_good') return (p.individualSeoCategory === 'Excellent' || p.individualSeoCategory === 'Good');
            if (filterSeoQuality === 'fair_poor') return (p.individualSeoCategory === 'Fair' || p.individualSeoCategory === 'Poor' || p.individualSeoCategory === 'N/A');
            // Numeric filtering
            if (filterSeoQuality.startsWith('below_')) {
                const threshold = parseFloat(filterSeoQuality.split('_')[1]);
                return (score !== undefined && score < threshold);
            }
            return p.individualSeoCategory?.toLowerCase() === filterSeoQuality;
        });
    }
    if (activeSearchTerm) {
        const term = activeSearchTerm.toLowerCase();
        tempProducts = tempProducts.filter(p => MANDATORY_FIELDS.some(f => p[f] && String(p[f]).toLowerCase().includes(term)) || (p.title && p.title.toLowerCase().includes(term)) || (p.description && p.description.toLowerCase().includes(term)));
    }
    return tempProducts;
  }, [products, activeSearchTerm, filterMissingAttribute, filterSeoQuality]);
  
  const visibleProducts = useMemo(() => allFilteredProducts.slice(0, displayedProductsCount), [allFilteredProducts, displayedProductsCount]);

  if (isAuthLoading) return <div style={{...styles.appContainer, backgroundColor: PRIMARY_COLOR}}><p style={{color: TEXT_COLOR_LIGHT}}>Loading...</p></div>;
  if (!user) return <Login onLoginSuccess={handleLoginSuccess} logoUrl={LOGO_URL} />;
  if (!userRole) return <RoleSelector onRoleSelect={setUserRole} onLanguageChange={setLanguage} currentLanguage={language} t={t} />;

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <div style={styles.headerLeft}><div style={styles.logoWrapper}><img src={LOGO_URL} alt="DentaTec Logo" style={styles.logo} /></div><h1 style={styles.title}>{APP_TITLE}</h1></div>
        <div style={styles.headerRight}>
            <span style={styles.userInfo}><i className="fa-regular fa-user-circle" style={{marginRight: '10px'}}></i> {t.welcomeUser(user.name, userRole)}</span>
            <button onClick={() => setUserRole(prev => prev === 'seller' ? 'buyer' : 'seller')} style={styles.roleSwitchButton}>{userRole === 'seller' ? t.switchToBuyer : t.switchToSeller}</button>
            <button onClick={handleLogout} style={styles.logoutButton}><i className="fa-solid fa-right-from-bracket"></i>{t.logout}</button>
        </div>
      </header>

      <div style={styles.tabContainer}>
        {userRole === 'seller' ? (
            <>
                <button style={{...styles.tabButton, ...(activeTab === 'feedAnalysis' && styles.activeTabButton)}} onClick={() => setActiveTab('feedAnalysis')}><i className="fa-solid fa-chart-pie"></i>{t.feedAnalysis}</button>
                {inputType === 'file' && originalFileHeaders.length > 0 && <button style={{...styles.tabButton, ...(activeTab === 'headerMapping' && styles.activeTabButton)}} onClick={() => setActiveTab('headerMapping')}><i className="fa-solid fa-right-left"></i>{t.headerMapping}</button>}
                <button style={{...styles.tabButton, ...(activeTab === 'supplierConfig' && styles.activeTabButton)}} onClick={() => setActiveTab('supplierConfig')}><i className="fa-solid fa-sliders"></i>{t.supplierConfig}</button>
            </>
        ) : (
            <>
                <button style={{...styles.tabButton, ...(activeTab === 'massOrder' && styles.activeTabButton)}} onClick={() => { setActiveTab('massOrder'); setMassOrderStep('input'); }}><i className="fa-solid fa-boxes-stacked"></i>{t.massOrder}</button>
                <button style={{...styles.tabButton, ...(activeTab === 'orders' && styles.activeTabButton)}} onClick={() => setActiveTab('orders')}><i className="fa-solid fa-receipt"></i>{t.orders}</button>
            </>
        )}
      </div>

      <main style={styles.mainContent}>
        {activeTab === 'feedAnalysis' && userRole === 'seller' && (
            <>
                <div style={styles.card}>
                    <label style={styles.label}>{t.dataSource}</label>
                    <div style={{display: 'flex', gap: '20px', marginBottom: '20px'}}>
                        <label><input type="radio" checked={inputType === 'url'} onChange={() => { setInputType('url'); setUploadedFile(null); resetStateForNewProcess(); }} /> {t.fetchFromUrl}</label>
                        <label><input type="radio" checked={inputType === 'file'} onChange={() => { setInputType('file'); setUploadedFile(null); resetStateForNewProcess(); }} /> {t.uploadFile}</label>
                    </div>
                    {inputType === 'url' ? (
                        <div style={{display: 'flex', gap: '10px'}}><input type="url" value={feedUrl} onChange={e => setFeedUrl(e.target.value)} style={{...styles.input, marginBottom: 0}} /><button onClick={handleProcessUrlFeed} disabled={isLoading} style={isLoading ? {...styles.button, ...styles.buttonDisabled} : styles.button}>{t.processUrl}</button></div>
                    ) : (
                        <div style={{display: 'flex', gap: '10px'}}><input type="file" onChange={e => setUploadedFile(e.target.files?.[0] || null)} style={{...styles.input, marginBottom: 0}} /><button onClick={handleProcessFileUpload} disabled={!uploadedFile || isLoading} style={!uploadedFile || isLoading ? {...styles.button, ...styles.buttonDisabled} : styles.button}>{t.processFile}</button></div>
                    )}
                    {error && <div style={styles.errorMessage}>{error}</div>}
                </div>
                {isLoading && loadingMessage && <div style={{...styles.card, textAlign: 'center'}}>{loadingMessage}</div>}
                {analysisData && !isLoading && <FeedAnalysisReport analysis={analysisData} overallSeoScore={overallFeedSeoScore} aiOptimizedSeoScore={aiOptimizedSeoScore} aiOptimizedCount={products.filter(p=>!!p.aiGeneratedDescription).length} />}
                {products.length > 0 && !isLoading && (
                    <>
                         {/* Moved Data Export to Top */}
                         <div style={styles.card}>
                            <h2 style={styles.contentTitle}>{t.dataExport}</h2>
                            <div style={{display: 'flex', gap: '15px', flexDirection: 'column'}}>
                                <button onClick={handleDownloadCsv} style={{...styles.button, backgroundColor: '#00385F'}}><i className="fa-solid fa-file-csv"></i> {t.downloadProcessedData}</button>
                                <button onClick={handleSubmitData} disabled={isExporting} style={isExporting ? {...styles.button, ...styles.buttonDisabled} : styles.button}><i className="fa-solid fa-cloud-arrow-up"></i> {isExporting ? 'Sending...' : t.submitData}</button>
                                {isExporting && <div style={{marginTop: '10px', color: '#666'}}><SpinnerIcon /> {exportMessage}</div>}
                            </div>
                        </div>

                        <div style={{ width: '100%', maxWidth: '1400px' }}>
                            <h2 style={{...styles.contentTitle, textAlign: 'left', backgroundColor: '#f8f9fa', paddingBottom: '15px', marginBottom: '20px'}}>{t.productViewer}</h2>
                            
                            {/* Bulk AI Actions Area */}
                            <div style={{...styles.card, marginBottom: '20px', borderLeft: `5px solid ${SECONDARY_COLOR}`}}>
                                <h3 style={{marginTop: 0, color: PRIMARY_COLOR, display: 'flex', alignItems: 'center', gap: '10px'}}><i className="fa-solid fa-wand-magic-sparkles"></i> {t.bulkAiActions}</h3>
                                <p style={{marginTop: 0, marginBottom: '20px', color: '#666'}}>
                                    Verarbeiten von gefilterten Produkten in Batches (max. {BATCH_SIZE} gleichzeitig).
                                </p>
                                <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                                    <button onClick={handleBulkOptimizeDescriptions} disabled={isBulkOptimizing || isBulkAnalyzing || isBulkVisualizing} style={isBulkOptimizing || isBulkAnalyzing || isBulkVisualizing ? {...styles.button, ...styles.buttonDisabled} : styles.button}>
                                        {isBulkOptimizing ? 'Optimizing Texts...' : 'Alle Texte optimieren (VM API)'}
                                    </button>
                                    <button onClick={handleBulkAnalyzeAttributes} disabled={isBulkOptimizing || isBulkAnalyzing || isBulkVisualizing} style={isBulkOptimizing || isBulkAnalyzing || isBulkVisualizing ? {...styles.button, ...styles.buttonDisabled} : styles.button}>
                                        {isBulkAnalyzing ? 'Analyzing Attributes...' : 'Alle Attribute analysieren (KI)'}
                                    </button>
                                    <button onClick={handleBulkVisualizeProducts} disabled={isBulkOptimizing || isBulkAnalyzing || isBulkVisualizing} style={isBulkOptimizing || isBulkAnalyzing || isBulkVisualizing ? {...styles.button, ...styles.buttonDisabled} : styles.button}>
                                        {isBulkVisualizing ? 'Generating Images...' : 'Alle Bilder visualisieren (Action Shot)'}
                                    </button>
                                </div>
                                <div style={{marginTop: '10px', fontSize: '0.85em', color: '#888', fontStyle: 'italic'}}>
                                    Hinweis: Die Textoptimierung nutzt eine Enterprise API, die für sehr große Mengen optimiert ist.
                                </div>
                            </div>

                            {/* Filters */}
                            <div style={styles.filterControls}>
                                <select value={filterSeoQuality} onChange={e => setFilterSeoQuality(e.target.value)} style={styles.filterSelect}>
                                    <option value="all">{t.showAllSeo}</option>
                                    <option value="excellent_good">{t.excellentGoodSeo}</option>
                                    <option value="fair_poor">{t.fairPoorSeo}</option>
                                    <option value="below_2.5">All Below Good (Score &lt; 2.5)</option>
                                    <option value="below_1.5">All Poor (Score &lt; 1.5)</option>
                                </select>
                                <input type="text" placeholder={t.searchPlaceholder} value={activeSearchTerm} onChange={e => setActiveSearchTerm(e.target.value)} style={{...styles.input, marginBottom: 0, maxWidth: '300px'}} />
                            </div>

                            <div style={styles.productGrid}>
                                {visibleProducts.map((p, i) => { const scores = productQualityScoresMap.get(p.id); return scores ? <ProductCard key={`${p.id}-${i}`} product={p} qualityScores={scores} onAnalyzeProductAttributes={handleAnalyzeProductAttributes} onVisualizeProduct={handleVisualizeProduct} onDescriptionUpdate={(id, desc) => updateProductState(id, { aiGeneratedDescription: desc })} onProductUpdate={updateProductState} /> : null; })}
                            </div>
                            {allFilteredProducts.length > displayedProductsCount && <button onClick={() => setDisplayedProductsCount(c => c + PRODUCTS_LOAD_INCREMENT)} style={{...styles.button, marginTop: '20px'}}>{t.loadMore}</button>}
                        </div>
                    </>
                )}
            </>
        )}
        {/* ... (Other tabs remain same) ... */}
        {activeTab === 'headerMapping' && userRole === 'seller' && (
             <div style={styles.card}>
                <h2 style={styles.contentTitle}>{t.reviewMappingTitle}</h2>
                <table style={styles.mappingTable}>
                    <thead><tr><th style={styles.mappingTableHeader}>{t.originalHeader}</th><th style={styles.mappingTableHeader}>{t.suggestedMapping}</th><th style={styles.mappingTableHeader}>{t.yourOverride}</th><th style={styles.mappingTableHeader}>{t.fallbackValue}</th></tr></thead>
                    <tbody>
                        {originalFileHeaders.map(h => (
                            <tr key={h}>
                                <td style={styles.mappingTableCell}>{h}</td><td style={styles.mappingTableCell}>{aiHeaderMapping[h]}</td>
                                <td style={styles.mappingTableCell}><select value={currentUserHeaderMapping[h] || DO_NOT_IMPORT_VALUE} onChange={e => setCurrentUserHeaderMapping(prev => ({...prev, [h]: e.target.value === DO_NOT_IMPORT_VALUE ? null : e.target.value}))} style={styles.mappingSelect}><option value={DO_NOT_IMPORT_VALUE}>{t.doNotImport}</option>{GOOGLE_SHOPPING_ATTRIBUTES.map(attr => <option key={attr} value={attr}>{attr}</option>)}</select></td>
                                <td style={styles.mappingTableCell}><input type="text" value={headerFallbacks[h] || ''} onChange={e => setHeaderFallbacks(prev => ({...prev, [h]: e.target.value}))} style={{width: '100%', border: 'none'}} placeholder="Fallback" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={handleApplyHeaderMapping} style={{...styles.button, marginTop: '20px'}}>{t.applyMapping}</button>
             </div>
        )}
        {activeTab === 'supplierConfig' && userRole === 'seller' && (
            <div style={styles.card}>
                <h2 style={styles.contentTitle}>{t.supplierConfigTitle}</h2>
                {/* CONFIG ERROR DISPLAY */}
                {error && error.includes("Lieferantenkonfiguration") && (
                     <div style={styles.errorMessage}>
                         <i className="fa-solid fa-triangle-exclamation" style={{marginRight: '10px'}}></i>
                         {error}
                     </div>
                )}
                <label style={styles.label}>{t.legalName}</label><input type="text" value={legalCompanyName} onChange={e => setLegalCompanyName(e.target.value)} style={styles.input} />
                <label style={styles.label}>{t.idPrefix}</label><input type="text" value={idPrefix} onChange={e => setIdPrefix(e.target.value)} style={styles.input} />
                <label style={styles.label}>{t.orderMethod}</label><select value={orderReceivingMethod} onChange={e => setOrderReceivingMethod(e.target.value as any)} style={{...styles.input, marginBottom: '20px'}}><option value="email">{t.byEmail}</option><option value="api">{t.viaApi}</option></select>
                <label style={styles.label}>{t.orderEmail}</label><input type="email" value={orderEmail} onChange={e => setOrderEmail(e.target.value)} style={styles.input} />
                
                <div style={{marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${BORDER_COLOR}`}}>
                    <label style={styles.label}>{t.marginLabel}</label>
                    <input 
                        type="number" 
                        value={dentaTecMarginPercent} 
                        onChange={e => setDentaTecMarginPercent(Number(e.target.value))} 
                        style={{...styles.input, width: '100px'}} 
                        min="0" 
                        max="100" 
                    />
                    <div style={{fontSize: '0.9em', color: '#666', marginTop: '-15px', marginBottom: '10px'}}>
                        {t.marginDescription}
                    </div>
                    <div style={{backgroundColor: '#e3f2fd', padding: '10px', borderRadius: '4px', fontSize: '0.9em', color: '#0d47a1'}}>
                        <i className="fa-solid fa-calculator" style={{marginRight: '8px'}}></i>
                        {t.cogsCalculation(dentaTecMarginPercent)}
                    </div>
                </div>
            </div>
        )}
        {activeTab === 'massOrder' && userRole === 'buyer' && (
             <div style={styles.card}>
                 <h2 style={styles.contentTitle}>{t.massOrderTitle}</h2>
                 
                 {massOrderStep === 'input' && (
                    <>
                        <p>{t.massOrderInstructions}</p>
                        <div style={{display: 'flex', gap: '20px', marginBottom: '20px'}}>
                            <label><input type="radio" checked={massOrderInputType === 'file'} onChange={() => setMassOrderInputType('file')} /> {t.uploadOrderFile}</label>
                            <label><input type="radio" checked={massOrderInputType === 'text'} onChange={() => setMassOrderInputType('text')} /> {t.pasteText}</label>
                        </div>
                        {massOrderInputType === 'file' ? (
                            <input type="file" onChange={e => setMassOrderFile(e.target.files?.[0] || null)} style={styles.input} />
                        ) : (
                            <textarea placeholder={t.pasteOrderDetails} style={{...styles.input, height: '150px'}} />
                        )}
                        <button onClick={() => handleProcessMassOrder(massOrderFile, "")} disabled={isProcessingMassOrder} style={isProcessingMassOrder ? {...styles.button, ...styles.buttonDisabled} : styles.button}>
                            {isProcessingMassOrder ? t.analyzing : t.submitData}
                        </button>
                    </>
                 )}

                 {massOrderStep === 'review' && (
                     <MassOrderReview 
                        items={extractedOrderItems}
                        catalog={dentaTecProducts}
                        onUpdateItem={handleUpdateOrderItem}
                        onDeleteItem={handleDeleteOrderItem}
                        onAddRow={handleAddOrderRow}
                        onConfirm={() => setMassOrderStep('confirm')}
                        onClear={() => { setExtractedOrderItems([]); setMassOrderStep('input'); setMassOrderComment(''); setExternalOrderNumber(''); }}
                        t={t}
                        comment={massOrderComment}
                        onCommentChange={setMassOrderComment}
                        externalOrderNumber={externalOrderNumber}
                        onExternalOrderNumberChange={setExternalOrderNumber}
                     />
                 )}

                 {massOrderStep === 'confirm' && (
                     <OrderConfirmation 
                        billingAddress={billingAddress}
                        shippingAddresses={shippingAddresses}
                        items={extractedOrderItems}
                        onBillingChange={(f, v) => setBillingAddress(prev => ({...prev, [f]: v}))}
                        onShippingChange={(idx, f, v) => setShippingAddresses(prev => prev.map((addr, i) => i === idx ? {...addr, [f]: v} : addr))}
                        onAddShipping={() => setShippingAddresses(prev => [...prev, {name: '', street: '', zip: '', city: '', country: 'Deutschland'}])}
                        onRemoveShipping={(idx) => setShippingAddresses(prev => prev.filter((_, i) => i !== idx))}
                        onUpdateItem={handleUpdateOrderItem}
                        onSubmit={handleFinalSubmitOrder}
                        onBack={() => setMassOrderStep('review')}
                        t={t}
                        initialComment={massOrderComment}
                     />
                 )}

                 {massOrderStep === 'success' && (
                     <div style={{textAlign: 'center', padding: '40px'}}>
                         <div style={{fontSize: '4em', color: '#4CAF50', marginBottom: '20px'}}><i className="fa-solid fa-circle-check"></i></div>
                         <h2 style={{color: PRIMARY_COLOR}}>{t.orderSuccessMessage}</h2>
                         <button onClick={() => { setMassOrderStep('input'); setExtractedOrderItems([]); setMassOrderComment(''); setExternalOrderNumber(''); }} style={{...styles.button, marginTop: '20px'}}>
                             {t.startOver}
                         </button>
                     </div>
                 )}
             </div>
        )}
        {activeTab === 'orders' && userRole === 'buyer' && (
            <OrderHistory user={user} t={t} />
        )}
      </main>
      <footer style={styles.footer}>© {new Date().getFullYear()} DentaTec. All rights reserved.</footer>
    </div>
  );
};

export default App;
