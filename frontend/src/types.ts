
export type QualityScoreName = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Too Short' | 'Too Long' | 'Optimal' | 'OK' | 'N/A';

export interface QualityScore {
    score: QualityScoreName;
    message: string;
    details?: string;
    numericScore: number; // 0 (N/A) to 4 (Excellent)
    keywordsFound?: number;
    totalKeywords?: number;
}

export interface ProductQualityScores {
    title: QualityScore;
    description: QualityScore;
    keywords: QualityScore;
}

export interface ParsedProduct {
  id: string;
  title: string;
  brand?: string;
  description: string;
  image_link: string;
  price: string;
  gtin?: string;
  mpn?: string;
  cost_of_goods_sold?: string;
  cogs_calculated?: boolean;    
  [key: string]: any; 
  individualSeoScore?: number; 
  individualSeoCategory?: QualityScoreName;
  
  // AI Analysis Fields
  aiCategory?: string; 
  aiColor?: string;    
  aiRiskScore?: 'Low' | 'Medium' | 'High';
  aiRiskDetails?: string;
  
  // Image AI Fields
  aiImageScore?: number;
  aiImageDimensions?: string;
  aiImageType?: string;
  aiImageReason?: string;

  aiError?: string;    
  isAiAnalysisLoading?: boolean; 

  // AI Visualization Fields
  aiVisualizedImage?: string;
  isAiVisualizationLoading?: boolean;
  
  aiGeneratedDescription?: string;
}

export interface User {
  email: string;
  kundennummer: string;
  name: string;
  straße?: string;
  plz?: string;
  land?: string;
  telefonnummer?: string;
}

export interface Order {
  sales_order_id: string;
  external_order_number?: string;
  date: string;
  sales_orders_net_revenue: string;
  sales_order_status: string;
  payment_method: string;
  payment_status: string;
  invoice_status: string;
  tracking_numbers?: string;
  tracking_links?: string;
  [key: string]: any;
}

export interface DentaTecProduct {
  sku: string;
  'hersteller-nr.': string;
  verkaufbar: string;
  'kalkulierter ek': string;
  'letzter ek': string;
  'letzter vk': string;
  produktname?: string;
  marke?: string;
  'produkt id'?: string;
  [key:string]: string;
}

export interface ExtractedOrderItem {
  id: string;
  productNumber: string;
  productName?: string;
  quantity: number;
  price?: number;
  matchedSku?: string | null;
  priceWarning?: boolean;
  matchedProduct?: DentaTecProduct;
  aiSuggestedMatch?: DentaTecProduct | null;
  isAiSuggestionAccepted?: boolean;
  isAiMatching?: boolean;
  shippingAddressIndex?: number; // Index into the shippingAddresses array
}

export interface Address {
    name: string;
    street: string;
    zip: string;
    city: string;
    country: string;
}

export interface AttributeAnalysisDetail {
  field: string;
  count: number;
  total: number;
  percentage: number;
  headerExists?: boolean;
  status: 'good' | 'warning' | 'missing';
  foundInFeedCount?: number;
  calculatedCount?: number;
}

export interface FeedAnalysisData {
  feedType: {
    type: 'XML' | 'CSV' | 'XLSX' | 'Unknown';
    details: string;
  };
  itemCount: {
    totalParsed: number;
    details?: string;
  };
  attributeAnalysis: AttributeAnalysisDetail[];
  overallFeedHealth: {
    message: string;
    status: 'good' | 'warning' | 'error';
  };
}

export type ActiveTab = 'feedAnalysis' | 'supplierConfig' | 'headerMapping' | 'massOrder' | 'orders';
export type UserRole = 'seller' | 'buyer';
export type InputType = 'url' | 'file';
