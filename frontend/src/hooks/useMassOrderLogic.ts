
import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ExtractedOrderItem, DentaTecProduct } from '../types';
import { geminiService } from '../services/geminiService';

type MassOrderStep = 'input' | 'review' | 'confirm' | 'success';

export const useMassOrderLogic = (catalog: DentaTecProduct[]) => {
    const [step, setStep] = useState<MassOrderStep>('input');
    const [items, setItems] = useState<ExtractedOrderItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [comment, setComment] = useState('');
    const [externalOrderNumber, setExternalOrderNumber] = useState('');
    const [uploadInputType, setUploadInputType] = useState<'file' | 'text'>('file');

    const runBackgroundMatching = useCallback(async (initialItems: ExtractedOrderItem[]) => {
        const normalize = (s: string | undefined) => s ? s.toString().trim().toLowerCase() : '';
        
        // 1. Immediate Exact Matching (Sync)
        const partiallyMatchedItems = initialItems.map(item => {
            const searchNum = normalize(item.productNumber);
            if (searchNum) {
                const match = catalog.find(p => normalize(p.sku) === searchNum || normalize(p['hersteller-nr.']) === searchNum);
                if (match) {
                    return { ...item, matchedSku: match.sku, matchedProduct: match, isAiMatching: false };
                }
            }
            return { ...item, isAiMatching: true }; // Mark for AI matching
        });

        // Update UI immediately with exact matches
        setItems(partiallyMatchedItems);

        // 2. Queue AI Matching for unmatched (Async)
        const unmatchedItems = partiallyMatchedItems.filter(i => i.isAiMatching);
        
        if (unmatchedItems.length === 0) return;

        // Prepare context string once (expensive operation)
        const contextStr = catalog.map(p => `${p.sku}|${p.produktname}|${p.marke}|${p['hersteller-nr.']}`).join('\n');

        // Process in small batches or individually to allow UI updates
        for (const item of unmatchedItems) {
            geminiService.findBestMatchAI(item, contextStr).then(matchedSku => {
                setItems(currentItems => currentItems.map(curr => {
                    if (curr.id === item.id) {
                        const product = matchedSku ? catalog.find(p => p.sku === matchedSku) : undefined;
                        return { 
                            ...curr, 
                            matchedSku: matchedSku, 
                            matchedProduct: product, 
                            isAiMatching: false 
                        };
                    }
                    return curr;
                }));
            });
        }
    }, [catalog]);

    const processUpload = async (file: File | null, textInput: string) => {
        if (uploadInputType === 'file' && !file) return alert("Please select a file.");
        setIsProcessing(true);

        try {
            let aiResult;
            if (uploadInputType === 'file' && file) {
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
                    const reader = new FileReader();
                    const text = await new Promise<string>((resolve) => {
                        reader.onload = (e) => {
                            const data = e.target?.result;
                            if (file.name.endsWith('.csv')) resolve(data as string);
                            else {
                                const wb = XLSX.read(data, {type:'array'});
                                resolve(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]));
                            }
                        };
                        if (file.name.endsWith('.csv')) reader.readAsText(file);
                        else reader.readAsArrayBuffer(file);
                    });
                    aiResult = await geminiService.processMassOrderAI('text', text);
                } else {
                    aiResult = await geminiService.processMassOrderAI('file', file);
                }
            } else {
                aiResult = await geminiService.processMassOrderAI('text', textInput);
            }

            if (aiResult && aiResult.items) {
                const initialItems: ExtractedOrderItem[] = aiResult.items.map((it: any, idx: number) => ({
                    id: `item-${Date.now()}-${idx}`,
                    productNumber: it.productNumber || '',
                    productName: it.productName || '',
                    quantity: it.quantity || 1,
                    price: it.price,
                    shippingAddressIndex: 0
                }));

                setComment(aiResult.specialInstructions || '');
                setExternalOrderNumber(aiResult.orderNumber || '');
                
                // Display Immediately
                setItems(initialItems); 
                setStep('review');
                // Trigger background match
                runBackgroundMatching(initialItems);
            }
        } catch (e: any) {
            alert(`Error processing file: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const updateItem = (id: string, field: string, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                if (field === 'productSelect') {
                    return { ...item, matchedProduct: value, matchedSku: value.sku };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const deleteItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
    
    const addItem = () => setItems(prev => [...prev, { id: `manual-${Date.now()}`, productNumber: '', productName: '', quantity: 1, shippingAddressIndex: 0 }]);

    return {
        step, setStep,
        items, setItems,
        isProcessing,
        comment, setComment,
        externalOrderNumber, setExternalOrderNumber,
        uploadInputType, setUploadInputType,
        processUpload,
        updateItem, deleteItem, addItem
    };
};
