
import { FeedAnalysisData, ParsedProduct, AttributeAnalysisDetail } from '../types';
import { MANDATORY_FIELDS_FOR_ANALYSIS, COGS_FIELD_NAME, DO_NOT_IMPORT_VALUE } from '../config';

export const feedService = {
  analyzeFeedData(
    parsedProducts: ParsedProduct[],
    feedSourceDetails: { type: 'URL' | 'CSV' | 'XLSX' | 'Unknown', name?: string, headers?: string[], delimiter?: string, isXml?: boolean, xmlItemCount?: { items: number, entries: number, products: number }, xmlNamespaceDetected?: boolean },
    cogsCounts?: { foundInFeed: number; calculated: number },
    currentUserHeaderMapping?: Record<string, string | null>
  ): FeedAnalysisData {
      const totalItems = parsedProducts.length;
      let feedTypeDetails = "";
      let itemCountDetails: string | undefined = undefined;

      if (feedSourceDetails.type === 'URL' && feedSourceDetails.isXml) {
          feedTypeDetails = feedSourceDetails.xmlNamespaceDetected 
              ? "XML with Google Shopping Namespace ('g:') detected."
              : "XML format. Google Shopping Namespace ('g:') not explicitly declared.";
          if (feedSourceDetails.xmlItemCount) {
              itemCountDetails = `Found ${feedSourceDetails.xmlItemCount.items} <item>, ${feedSourceDetails.xmlItemCount.entries} <entry>, ${feedSourceDetails.xmlItemCount.products} <product> elements.`;
          }
      } else if (feedSourceDetails.type === 'URL' && !feedSourceDetails.isXml) { 
          feedTypeDetails = `CSV/Text format (from URL). Detected Delimiter: '${feedSourceDetails.delimiter === '\t' ? 'Tab (\\t)' : feedSourceDetails.delimiter}'.`;
          if (feedSourceDetails.headers) {
            feedTypeDetails += ` Detected Headers (${feedSourceDetails.headers.length}): ${feedSourceDetails.headers.join(' | ')}`;
          }
      } else if (feedSourceDetails.type === 'CSV' || feedSourceDetails.type === 'XLSX') {
          feedTypeDetails = `${feedSourceDetails.type} file: ${feedSourceDetails.name || 'Uploaded File'}.`;
          if (feedSourceDetails.headers) {
              feedTypeDetails += ` Headers (${feedSourceDetails.headers.length}): ${feedSourceDetails.headers.slice(0, 5).join(' | ')}${feedSourceDetails.headers.length > 5 ? '...' : ''}`;
          }
          if (feedSourceDetails.type === 'CSV' && feedSourceDetails.delimiter) {
              feedTypeDetails += ` Delimiter: '${feedSourceDetails.delimiter === '\t' ? 'Tab (\\t)' : feedSourceDetails.delimiter}'.`;
          }
      } else {
          feedTypeDetails = "Feed source type is unknown or not specified.";
      }
      
      const attributeAnalysis: AttributeAnalysisDetail[] = MANDATORY_FIELDS_FOR_ANALYSIS.map(field => {
          let count = parsedProducts.filter(p => p[field] && String(p[field]).trim() !== '').length;
          let percentage: number;
          let status: 'good' | 'warning' | 'missing' = 'missing';
          
          const headerExistsInSource = (feedSourceDetails.type === 'CSV' || feedSourceDetails.type === 'XLSX') 
              ? (currentUserHeaderMapping && Object.values(currentUserHeaderMapping).includes(field)) 
              : (feedSourceDetails.isXml || (feedSourceDetails.headers ? feedSourceDetails.headers.map(h => h.toLowerCase()).includes(field.toLowerCase()) : true));
          
          let foundInFeedCount: number | undefined = undefined;
          let calculatedCount: number | undefined = undefined;

          if (field === COGS_FIELD_NAME && cogsCounts) {
              count = cogsCounts.foundInFeed + cogsCounts.calculated;
              percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
              foundInFeedCount = cogsCounts.foundInFeed;
              calculatedCount = cogsCounts.calculated;
          } else {
              percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
          }
          
          if (headerExistsInSource || (field === COGS_FIELD_NAME && count > 0) ) { 
              if (percentage >= 90) status = 'good';
              else if (percentage >= 50) status = 'warning';
          }

          return { 
              field, 
              count, 
              total: totalItems, 
              percentage, 
              headerExists: headerExistsInSource, 
              status,
              foundInFeedCount,
              calculatedCount
          };
      });

      const criticalFields = ['id', 'title', 'price', 'image_link', 'description'];
      const wellPopulatedCriticalFields = criticalFields.filter(field => {
          const analysisResult = attributeAnalysis.find(attr => attr.field === field);
          return analysisResult && analysisResult.percentage > 70;
      }).length;

      let overallFeedHealthMessage = "Feed appears empty or no products were parsed.";
      let overallFeedHealthStatus: 'good' | 'warning' | 'error' = 'error';

      if (totalItems > 0) {
          if (wellPopulatedCriticalFields >= 4) {
              overallFeedHealthMessage = "Feed is reasonably well-structured for key attributes.";
              overallFeedHealthStatus = 'good';
          } else if (wellPopulatedCriticalFields >=2) {
              overallFeedHealthMessage = "Some critical attributes may be missing or sparse. Manual verification recommended.";
              overallFeedHealthStatus = 'warning';
          } else {
              overallFeedHealthMessage = "Several critical attributes are largely missing. Significant issues likely.";
              overallFeedHealthStatus = 'error';
          }
      }

      let determinedReportFeedType: 'XML' | 'CSV' | 'XLSX' | 'Unknown' = 'Unknown';
      if (feedSourceDetails.isXml) {
          determinedReportFeedType = 'XML';
      } else {
          if (feedSourceDetails.type === 'URL') { 
              determinedReportFeedType = 'CSV'; 
          } else if (feedSourceDetails.type === 'CSV' || feedSourceDetails.type === 'XLSX') {
              determinedReportFeedType = feedSourceDetails.type; 
          }
      }

      return {
          feedType: { type: determinedReportFeedType, details: feedTypeDetails },
          itemCount: { totalParsed: totalItems, details: itemCountDetails },
          attributeAnalysis,
          overallFeedHealth: { message: overallFeedHealthMessage, status: overallFeedHealthStatus }
      };
  },

  parseCsvRow(rowString: string, delimiter: string): string[] {
    const values: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < rowString.length; i++) {
        const char = rowString[i];
        if (char === '"') {
            if (inQuotes && i + 1 < rowString.length && rowString[i + 1] === '"') {
                currentField += '"'; i++; 
            } else { inQuotes = !inQuotes; }
        } else if (char === delimiter && !inQuotes) {
            values.push(currentField.trim()); currentField = "";
        } else { currentField += char; }
    }
    values.push(currentField.trim()); 
    return values;
  },

  parseAsCsvFull(text: string): { products: ParsedProduct[]; headers?: string[]; delimiter?: string; error?: string; rawData?: {[key: string]: string}[] } {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length === 0) return { products: [], error: "CSV is empty." };
      const headerLine = lines[0]; 
      let delimiter = '';
      const commonDelimiters = [',', ';', '\t', '|'];
      let maxCols = 0;
      for (const d of commonDelimiters) {
          const cols = headerLine.split(d).length; 
          if (cols > maxCols) { maxCols = cols; delimiter = d; }
      }
      if (maxCols <=1 && !delimiter) delimiter = ","; 
      const headers = this.parseCsvRow(headerLine, delimiter).map(h => h.toLowerCase().replace(/^["']|["']$/g, ''));
      const dataRows = lines.slice(1).filter(line => line.trim() !== '');
      const rawDataObjects: {[key: string]: string}[] = [];
      dataRows.forEach(rowLine => {
          const values = this.parseCsvRow(rowLine, delimiter);
          const rowObject: {[key: string]: string} = {};
          headers.forEach((header, index) => {
              if (values[index] !== undefined) rowObject[header] = values[index]; 
          });
          if (Object.keys(rowObject).length > 0) rawDataObjects.push(rowObject);
      });
      return { products: [], rawData: rawDataObjects, headers, delimiter };
  },

  getProductAttribute(item: Element, fieldName: string, namespace: string | null): string {
    let element: Element | null = null;
    const potentialNames = [fieldName];
    const baseFieldName = fieldName.startsWith('g:') ? fieldName.substring(2) : fieldName;
    if (baseFieldName !== fieldName) potentialNames.push(baseFieldName);
    if (fieldName.includes('_')) potentialNames.push(fieldName.replace('_', ' '));
    
    for (const name of potentialNames) {
        if (namespace) {
          element = item.getElementsByTagNameNS(namespace, name)[0];
          if (element) break;
        }
    }

    if (!element) {
        for (const name of potentialNames) {
             if (namespace && name === baseFieldName) { 
                element = item.querySelector(`:scope > g\\:${name.replace(/[^a-zA-Z0-9-]/g, '')}`);
            }
            if (!element) {
                element = item.querySelector(`:scope > ${name.replace(/[^a-zA-Z0-9-]/g, '\\$&')}`);
            }
            if(element) break;
            if (!element) element = item.getElementsByTagName(name)[0]; 
            if (element) break;
        }
    }
    const value = element?.textContent?.trim() || '';
    return value;
  },

  applyHeaderMapping(
      currentRawData: {[key: string]: any}[],
      currentMapping: Record<string, string | null>,
      currentFallbacks: Record<string, string>,
      currentOriginalHeaders: string[]
  ): ParsedProduct[] {
      const transformedProducts: ParsedProduct[] = [];
      const chunk = currentRawData; 
      
      const processedChunk = chunk.map(rawObj => {
          const product: ParsedProduct = { id: '', title: '', description: '', image_link: '', price: '' };
          const tempProductValues: Record<string, string[]> = {}; 
          for (const originalHeader of currentOriginalHeaders) { 
              if (currentMapping.hasOwnProperty(originalHeader)) {
                  const googleAttribute = currentMapping[originalHeader];
                  if (googleAttribute && googleAttribute !== DO_NOT_IMPORT_VALUE) {
                      let valueFromRaw = rawObj[originalHeader];
                      let effectiveValue = (valueFromRaw !== null && valueFromRaw !== undefined && String(valueFromRaw).trim() !== "") ? String(valueFromRaw).trim() : undefined;
                      const fallbackForHeader = currentFallbacks[originalHeader];
                      if (effectiveValue === undefined && fallbackForHeader !== null && fallbackForHeader !== undefined && String(fallbackForHeader).trim() !== "") {
                          effectiveValue = String(fallbackForHeader).trim();
                      }
                      if (effectiveValue !== undefined) {
                          if (!tempProductValues[googleAttribute]) tempProductValues[googleAttribute] = [];
                          tempProductValues[googleAttribute].push(effectiveValue);
                      }
                  }
              }
          }
          for (const googleAttr in tempProductValues) {
              if (tempProductValues.hasOwnProperty(googleAttr)) (product as any)[googleAttr] = tempProductValues[googleAttr].join(" ").trim();
          }
          product.id = String(product.id || ''); product.title = String(product.title || ''); product.description = String(product.description || '');
          product.image_link = String(product.image_link || ''); product.price = String(product.price || '');
          return product;
      }).filter(p => p.id && p.title);
      transformedProducts.push(...processedChunk);
      
      return transformedProducts;
  }
};
