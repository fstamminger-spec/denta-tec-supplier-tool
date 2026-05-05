
import { useState } from 'react';
import { ParsedProduct, ProductQualityScores, QualityScoreName } from '../types';
import { geminiService } from '../services/geminiService';
import { analyzeTitle, analyzeDescription, analyzeKeywordDensity } from '../qualityChecker';

export const useProductActions = (
    initialProduct: ParsedProduct, 
    initialScores: ProductQualityScores,
    onUpdateProduct: (id: string, updates: Partial<ParsedProduct>) => void
) => {
    const [isOptimizingTitle, setIsOptimizingTitle] = useState(false);
    const [titleError, setTitleError] = useState<string | null>(null);
    const [currentScores, setCurrentScores] = useState<ProductQualityScores>(initialScores);

    const getNumericScoreCategory = (numericScore: number): QualityScoreName => {
        if (numericScore >= 3.5) return 'Excellent'; 
        if (numericScore >= 2.5) return 'Good'; 
        if (numericScore >= 1.5) return 'Fair'; 
        if (numericScore > 0) return 'Poor'; 
        return 'N/A';
    };

    const recalculateSeoScores = (product: ParsedProduct): { scores: ProductQualityScores, individualScore: number, category: QualityScoreName } => {
        const titleAnalysis = analyzeTitle(product.title);
        const descAnalysis = analyzeDescription(product.aiGeneratedDescription || product.description);
        const kwAnalysis = analyzeKeywordDensity(product.title, product.aiGeneratedDescription || product.description);

        const titleScore = titleAnalysis.numericScore * 0.4; 
        const descScore = descAnalysis.numericScore * 0.3; 
        const keywordScore = kwAnalysis.numericScore * 0.3; 
        const individualScore = titleScore + descScore + keywordScore;
        const category = getNumericScoreCategory(individualScore);

        return {
            scores: { title: titleAnalysis, description: descAnalysis, keywords: kwAnalysis },
            individualScore,
            category
        };
    };

    const handleTitleOptimization = async () => {
        setIsOptimizingTitle(true);
        setTitleError(null);
        try {
            const newTitle = await geminiService.optimizeProductTitle(
                initialProduct.title, 
                initialProduct.aiGeneratedDescription || initialProduct.description, 
                initialProduct.brand
            );
            
            // Create temp product to recalc scores
            const updatedProduct = { ...initialProduct, title: newTitle };
            const recalc = recalculateSeoScores(updatedProduct);
            
            setCurrentScores(recalc.scores);
            onUpdateProduct(initialProduct.id, { 
                title: newTitle, 
                individualSeoScore: recalc.individualScore,
                individualSeoCategory: recalc.category
            });
        } catch (e: any) {
            setTitleError(e.message);
        } finally {
            setIsOptimizingTitle(false);
        }
    };

    // Wrapper for description update to also trigger score recalc
    const handleDescriptionUpdate = (newDesc: string) => {
        const updatedProduct = { ...initialProduct, aiGeneratedDescription: newDesc };
        const recalc = recalculateSeoScores(updatedProduct);
        setCurrentScores(recalc.scores);
        onUpdateProduct(initialProduct.id, { 
            aiGeneratedDescription: newDesc,
            individualSeoScore: recalc.individualScore,
            individualSeoCategory: recalc.category
        });
    };

    return {
        isOptimizingTitle,
        titleError,
        currentScores,
        handleTitleOptimization,
        handleDescriptionUpdate
    };
};
