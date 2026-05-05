
import React, { useState, useEffect } from 'react';
import type { ParsedProduct, ProductQualityScores, QualityScoreName } from './types'; 
import { optimizationService } from './services/optimizationService';
import { VIRTUAL_MARKETER_LOGO_URL } from './config';
import { useProductActions } from './hooks/useProductActions';

interface ProductCardProps {
    product: ParsedProduct;
    qualityScores: ProductQualityScores;
    onAnalyzeProductAttributes: (productId: string) => void; 
    onVisualizeProduct: (productId: string) => void;        
    onDescriptionUpdate: (productId: string, newDescription: string) => void;
    onProductUpdate: (id: string, data: Partial<ParsedProduct>) => void; // New prop for generic updates
}

const SparkleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.55 5.55h5.8l-4.7 3.45 1.8 5.6-4.65-3.4-4.65 3.4 1.8-5.6-4.7-3.45h5.8z"/></svg>;
const WandIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m2 2 2 2"/><path d="m8 2-2 2"/><path d="m2 8 2-2"/></svg>; // Simplified wand

const ProductCard: React.FC<ProductCardProps> = ({ product, qualityScores, onAnalyzeProductAttributes, onVisualizeProduct, onProductUpdate }) => {
    const TEXT_COLOR_DARK = "#333";
    const BORDER_COLOR = "#e0e0e0"; 
    const PRIMARY_COLOR = "#00385F"; 
    const SECONDARY_COLOR = "#ED6501"; 
    const ERROR_COLOR_TEXT = "#D32F2F";

    // Hook handles optimization logic and score recalculation
    const { isOptimizingTitle, titleError, currentScores, handleTitleOptimization, handleDescriptionUpdate } = useProductActions(product, qualityScores, onProductUpdate);

    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenerationError, setRegenerationError] = useState<string | null>(null);
    const [attributesRevealed, setAttributesRevealed] = useState(false);
    const [visualRevealed, setVisualRevealed] = useState(false);
    const [displayVersion, setDisplayVersion] = useState<'original' | 'ai'>('original');
    const [vmModels, setVmModels] = useState<{name: string}[]>([]);
    const [selectedVmModel, setSelectedVmModel] = useState<string>('');
    const [isVmModelsLoading, setIsVmModelsLoading] = useState<boolean>(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    
    // Carousel State
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    useEffect(() => {
        const links = [product.image_link];
        if (product.additional_image_link) {
            links.push(...product.additional_image_link.split(',').map(s => s.trim()));
        }
        setImageUrls(links.filter(l => l && l.length > 0));
        setCurrentImageIndex(0);
    }, [product.image_link, product.additional_image_link]);

    const styles: { [key: string]: React.CSSProperties } = {
        card: { border: `1px solid ${BORDER_COLOR}`, borderRadius: '10px', padding: '20px', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '15px', color: TEXT_COLOR_DARK, fontFamily: "'Inter', sans-serif", height: '100%', position: 'relative' },
        imageContainer: { width: '100%', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '6px', border: `1px solid ${BORDER_COLOR}`, marginBottom: '10px', backgroundColor: '#f9f9f9', position: 'relative' },
        image: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
        noImageText: { fontSize: '0.9em', color: '#777' },
        title: { fontSize: '1.2em', fontWeight: '600', color: PRIMARY_COLOR, margin: '0 0 8px 0', lineHeight: '1.35', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flexGrow: 1 },
        price: { fontSize: '1.25em', fontWeight: 'bold', color: SECONDARY_COLOR, margin: '5px 0 10px 0' },
        attributeSection: { borderTop: `1px solid ${BORDER_COLOR}`, paddingTop: '10px' },
        attribute: { fontSize: '0.9em', marginBottom: '5px', lineHeight: '1.4', color: '#454545' },
        attributeLabel: { fontWeight: '600', color: '#222', marginRight: '5px' },
        descriptionText: { fontSize: '0.88em', color: '#505050', lineHeight: '1.5', wordBreak: 'break-word', overflow: 'hidden', transition: 'max-height 0.3s ease' },
        readMoreBtn: { background: 'none', border: 'none', color: PRIMARY_COLOR, cursor: 'pointer', fontSize: '0.85em', fontWeight: '600', padding: '5px 0', display: 'flex', alignItems: 'center', gap: '5px' },
        aiInsightsSection: { backgroundColor: '#f4f8fa', padding: '15px', borderRadius: '8px', marginTop: 'auto', border: `1px solid #dfe6eb` },
        aiTitle: { fontSize: '1.05em', fontWeight: '600', color: PRIMARY_COLOR, marginBottom: '12px' },
        aiDetailRow: { display: 'flex', alignItems: 'flex-start', marginBottom: '10px', minHeight: '28px' },
        aiDetailLabel: { fontWeight: '500', color: TEXT_COLOR_DARK, minWidth: '120px', fontSize: '0.9em', paddingTop: '2px' },
        detailValue: { flexGrow: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
        colorSwatch: { display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', marginRight: '8px', border: '1px solid rgba(0,0,0,0.2)', verticalAlign: 'middle' },
        aiErrorText: { color: ERROR_COLOR_TEXT, fontSize: '0.9em', fontWeight: '500', marginLeft: '5px', whiteSpace: 'pre-wrap', marginTop: '8px' },
        aiRegenerationSection: { backgroundColor: '#e8f4fd', border: `1px solid #b3d4f0`, borderRadius: '8px', padding: '15px', marginTop: '15px', textAlign: 'center' },
        upliftInfo: { marginBottom: '12px' },
        upliftText: { fontSize: '1em', fontWeight: '600', color: PRIMARY_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
        upliftDescription: { fontSize: '0.85em', color: '#555', margin: '2px 0 0 0' },
        modelSelectorGroup: { marginBottom: '15px' },
        modelSelectLabel: { display: 'block', fontSize: '0.9em', fontWeight: '500', color: PRIMARY_COLOR, marginBottom: '5px' },
        modelSelect: { width: '100%', padding: '8px', borderRadius: '4px', border: `1px solid #b3d4f0`, backgroundColor: '#fff' },
        regenerateButton: { backgroundColor: SECONDARY_COLOR, color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 18px', fontSize: '0.9em', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.3s ease', width: '100%' },
        regenerateButtonDisabled: { backgroundColor: '#BDBDBD', cursor: 'not-allowed' },
        regeneratedBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#e8f4fd', color: PRIMARY_COLOR, padding: '4px 10px', borderRadius: '12px', fontSize: '0.8em', fontWeight: '500', border: `1px solid ${PRIMARY_COLOR}80` },
        aiActionButton: { backgroundColor: '#fff', color: PRIMARY_COLOR, border: `1px solid ${PRIMARY_COLOR}`, borderRadius: '6px', padding: '8px 16px', fontSize: '0.85em', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease', width: '100%', marginBottom: '10px' },
        loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100px' },
        glowingLogo: { width: '80px', height: '80px', animation: 'marketerGlow 2.5s infinite ease-in-out' },
        toggleContainer: { display: 'flex', border: `1px solid ${PRIMARY_COLOR}`, borderRadius: '16px', overflow: 'hidden' },
        toggleButton: { padding: '4px 12px', border: 'none', backgroundColor: '#fff', color: PRIMARY_COLOR, cursor: 'pointer', fontSize: '0.8em', transition: 'background-color 0.2s ease' },
        toggleButtonActive: { padding: '4px 12px', border: 'none', backgroundColor: PRIMARY_COLOR, color: '#fff', cursor: 'pointer', fontSize: '0.8em' },
        riskPill: { padding: '4px 10px', borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '0.85em', display: 'inline-block' },
        cvrPill: { padding: '4px 10px', borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '0.85em', display: 'inline-block', minWidth: '40px', textAlign: 'center' },
        carouselBtn: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
        carouselIndicator: { position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px', zIndex: 2 },
        dot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.5)', cursor: 'pointer' },
        activeDot: { backgroundColor: 'white' },
        seoScoreBadge: { position: 'absolute', top: '10px', right: '10px', backgroundColor: PRIMARY_COLOR, color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8em', fontWeight: 'bold', zIndex: 3 },
        magicButton: { border: 'none', background: 'transparent', cursor: 'pointer', color: SECONDARY_COLOR, padding: '5px', marginLeft: '5px' }
    };

    const getPredictiveUplift = (score: QualityScoreName): string | null => {
        switch (score) { case 'N/A': case 'Too Short': return "+40-60%"; case 'Poor': return "+25-40%"; case 'Fair': return "+10-25%"; default: return null; }
    };
    
    const predictiveUplift = getPredictiveUplift(currentScores.description.score);

    useEffect(() => {
        if (predictiveUplift) {
            const fetchVmModels = async () => {
                setIsVmModelsLoading(true); setRegenerationError(null);
                try {
                    const models = await optimizationService.fetchModels();
                    setVmModels(models);
                    const defaultModel = 'dentatec_Produktbeschreibung-HTML_Deutsch';
                    setSelectedVmModel(models.some((m: any) => m.name === defaultModel) ? defaultModel : models[0]?.name || '');
                } catch (error: any) { setRegenerationError(error.message); } finally { setIsVmModelsLoading(false); }
            };
            fetchVmModels();
        }
    }, [predictiveUplift]);

    const handleVmRegenerateDescription = async () => {
        if (!selectedVmModel) { setRegenerationError("Please select an AI model."); return; }
        setIsRegenerating(true); setRegenerationError(null);
        try {
            const context = `Product: ${product.title}. Description: ${product.description}`;
            const newText = await optimizationService.regenerateDescription(selectedVmModel, context);
            handleDescriptionUpdate(newText);
            setDisplayVersion('ai');
        } catch (e: any) { setRegenerationError(e.message || "Failed to regenerate description."); } finally { setIsRegenerating(false); }
    };

    const currentDescription = displayVersion === 'ai' && product.aiGeneratedDescription ? product.aiGeneratedDescription : product.description;
    
    const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length);
    const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);

    const ImageComponent = () => {
        const [hasError, setHasError] = React.useState(false);
        const url = imageUrls[currentImageIndex];
        if (!url || hasError) return <div style={styles.imageContainer}><span style={styles.noImageText}>No Image</span></div>;
        return (
            <div style={styles.imageContainer}>
                {imageUrls.length > 1 && (
                    <>
                        <button style={{...styles.carouselBtn, left: '5px'}} onClick={(e) => {e.stopPropagation(); prevImage();}}><i className="fa-solid fa-chevron-left"></i></button>
                        <button style={{...styles.carouselBtn, right: '5px'}} onClick={(e) => {e.stopPropagation(); nextImage();}}><i className="fa-solid fa-chevron-right"></i></button>
                        <div style={styles.carouselIndicator}>
                            {imageUrls.map((_, idx) => (
                                <div key={idx} style={{...styles.dot, ...(idx === currentImageIndex ? styles.activeDot : {})}} onClick={() => setCurrentImageIndex(idx)} />
                            ))}
                        </div>
                    </>
                )}
                <img src={url} alt={product.title} style={styles.image} onError={() => setHasError(true)} />
            </div>
        );
    };
    
    const getRiskColor = (score: string) => { if (score === 'Low') return '#4CAF50'; if (score === 'Medium') return '#FF9800'; return '#F44336'; };
    const getCvrScoreColor = (score: number) => { if (score >= 80) return '#4CAF50'; if (score >= 60) return '#8BC34A'; if (score >= 40) return '#FFC107'; return '#F44336'; };

    const scoreVal = product.individualSeoScore !== undefined ? product.individualSeoScore.toFixed(1) : "N/A";
    const scoreColor = product.individualSeoScore && product.individualSeoScore >= 3.5 ? '#4CAF50' : product.individualSeoScore && product.individualSeoScore >= 2.5 ? '#8BC34A' : product.individualSeoScore && product.individualSeoScore >= 1.5 ? '#FFC107' : '#F44336';

    return (
        <div style={styles.card} aria-labelledby={`product-title-${product.id}`}>
            <style>{` @keyframes marketerGlow { 0% { filter: drop-shadow(0 0 3px rgba(161, 201, 232, 0.7)); } 50% { filter: drop-shadow(0 0 12px rgba(144, 11, 25, 0.8)); } 100% { filter: drop-shadow(0 0 3px rgba(161, 201, 232, 0.7)); } } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .product-description-container p { margin: 0 0 0.75em 0; } `}</style>
            
            {product.individualSeoScore !== undefined && (
                <div style={{...styles.seoScoreBadge, backgroundColor: scoreColor}}>
                    SEO: {scoreVal}
                </div>
            )}

            <ImageComponent />
            
            <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'}}>
                <h3 id={`product-title-${product.id}`} style={styles.title} title={product.title}>
                    {product.title || 'N/A'}
                </h3>
                <button 
                    onClick={handleTitleOptimization} 
                    disabled={isOptimizingTitle}
                    style={styles.magicButton} 
                    title="Optimize Title with AI"
                >
                    {isOptimizingTitle ? <i className="fa-solid fa-spinner fa-spin"></i> : <WandIcon />}
                </button>
            </div>
            {titleError && <div style={{color: ERROR_COLOR_TEXT, fontSize: '0.8em', marginBottom: '5px'}}>{titleError}</div>}

            <div style={styles.attributeSection}>
                {product.price && <p style={{...styles.price, marginBottom: '5px'}}><span style={styles.attributeLabel}>Selling Price:</span> {product.price}</p>}
                {product.cost_of_goods_sold && <p style={{...styles.attribute, color: product.cogs_calculated ? PRIMARY_COLOR : undefined, fontStyle: product.cogs_calculated ? 'italic' : undefined}}><span style={styles.attributeLabel}>COGS:</span> {product.cost_of_goods_sold} {product.cogs_calculated && <span style={{fontSize: '0.8em'}}>(calc)</span>}</p>}
                {product.brand && <p style={styles.attribute}><span style={styles.attributeLabel}>Brand:</span> {product.brand}</p>}
                <p style={styles.attribute}><span style={styles.attributeLabel}>ID:</span> {product.id || 'N/A'}</p>
                {product.gtin && <p style={styles.attribute}><span style={styles.attributeLabel}>GTIN:</span> {product.gtin}</p>}
                {product.mpn && <p style={styles.attribute}><span style={styles.attributeLabel}>MPN:</span> {product.mpn}</p>}
            </div>
            {(product.description || product.aiGeneratedDescription) && (
                <div>
                    <p style={{...styles.attributeLabel, marginBottom: '5px'}}>Description:</p>
                     {product.aiGeneratedDescription && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                            <div style={styles.regeneratedBadge}><SparkleIcon /> AI-Generated</div>
                            <div style={styles.toggleContainer}>
                                <button onClick={() => setDisplayVersion('original')} style={displayVersion === 'original' ? styles.toggleButtonActive : styles.toggleButton}>Original</button>
                                <button onClick={() => setDisplayVersion('ai')} style={displayVersion === 'ai' ? styles.toggleButtonActive : styles.toggleButton}>AI-Generated</button>
                            </div>
                        </div>
                    )}
                    <div 
                        className="product-description-container" 
                        style={{
                            ...styles.descriptionText, 
                            maxHeight: isDescriptionExpanded ? 'none' : '100px', 
                            maskImage: isDescriptionExpanded ? 'none' : 'linear-gradient(to bottom, black 50%, transparent 100%)'
                        }} 
                        dangerouslySetInnerHTML={{ __html: currentDescription || '' }} 
                    />
                    <button onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} style={styles.readMoreBtn}>
                        {isDescriptionExpanded ? <><i className="fa-solid fa-chevron-up"></i> Show Less</> : <><i className="fa-solid fa-chevron-down"></i> Show More</>}
                    </button>
                </div>
            )}
            {predictiveUplift && (
                <div style={styles.aiRegenerationSection}>
                    <div style={styles.upliftInfo}><div style={styles.upliftText}><SparkleIcon /> Predictive Uplift: {predictiveUplift}</div><p style={styles.upliftDescription}>AI-optimized descriptions typically perform better.</p></div>
                    <div style={styles.modelSelectorGroup}>
                        <label style={styles.modelSelectLabel}>Select Optimization Model:</label>
                        {isVmModelsLoading ? <div style={{fontSize: '0.85em', color: '#666'}}>Loading models...</div> : <select value={selectedVmModel} onChange={(e) => setSelectedVmModel(e.target.value)} style={styles.modelSelect} disabled={isRegenerating}>{vmModels.map(model => <option key={model.name} value={model.name}>{model.name}</option>)}</select>}
                    </div>
                    {regenerationError && <div style={{...styles.aiErrorText, marginBottom: '10px', display: 'block'}}>Error: {regenerationError}</div>}
                    <button onClick={handleVmRegenerateDescription} disabled={isRegenerating || isVmModelsLoading || !selectedVmModel} style={isRegenerating || isVmModelsLoading || !selectedVmModel ? {...styles.regenerateButton, ...styles.regenerateButtonDisabled} : styles.regenerateButton}>{isRegenerating ? 'Optimizing...' : 'Regenerate Description'}</button>
                </div>
            )}
            <div style={styles.aiInsightsSection}> 
                <h4 style={styles.aiTitle}>Automated Insights</h4>
                {product.aiError && attributesRevealed && <div style={styles.aiDetailRow}><span style={{color: ERROR_COLOR_TEXT, marginRight: '5px'}}>⚠️</span><span style={styles.aiErrorText}>{product.aiError}</span></div>}
                {attributesRevealed ? (
                    product.isAiAnalysisLoading ? ( <div style={styles.loadingContainer}><img src={VIRTUAL_MARKETER_LOGO_URL} alt="Loading..." style={styles.glowingLogo} /><p style={{fontSize: '0.9em', color: PRIMARY_COLOR, marginTop: '10px'}}>Analyzing attributes & media...</p></div> ) : (
                        <>
                            <div style={styles.aiDetailRow}><span style={styles.aiDetailLabel}>Dominant Color:</span><div style={styles.detailValue}>{product.aiColor ? <><span style={{...styles.colorSwatch, backgroundColor: product.aiColor.toLowerCase()}}></span>{product.aiColor}</> : <span style={styles.noImageText}>Not analyzed</span>}</div></div>
                            <div style={styles.aiDetailRow}><span style={styles.aiDetailLabel}>Google Category:</span><div style={styles.detailValue}>{product.aiCategory || <span style={styles.noImageText}>Not analyzed</span>}</div></div>
                            <div style={styles.aiDetailRow}><span style={styles.aiDetailLabel}>Risk Score:</span><div style={styles.detailValue}>{product.aiRiskScore ? <span style={{...styles.riskPill, backgroundColor: getRiskColor(product.aiRiskScore)}}>{product.aiRiskScore}</span> : <span style={styles.noImageText}>Not analyzed</span>}</div></div>
                            <div style={styles.aiDetailRow}><span style={styles.aiDetailLabel}>CVR Potential:</span><div style={styles.detailValue}>{product.aiImageScore !== undefined ? <span style={{...styles.cvrPill, backgroundColor: getCvrScoreColor(product.aiImageScore)}}>{product.aiImageScore}%</span> : <span style={styles.noImageText}>N/A</span>}</div></div>
                            {product.aiImageDimensions && <div style={styles.aiDetailRow}><span style={styles.aiDetailLabel}>Image Size:</span><div style={styles.detailValue}><span style={{fontSize: '0.9em'}}>{product.aiImageDimensions}px</span></div></div>}
                            {product.aiImageType && <div style={styles.aiDetailRow}><span style={styles.aiDetailLabel}>Image Type:</span><div style={styles.detailValue}><span style={{fontSize: '0.9em', fontWeight: '500', color: '#555'}}>{product.aiImageType}</span></div></div>}
                            {product.aiRiskDetails && <div style={styles.aiDetailRow}><span style={styles.aiDetailLabel}>Risk Details:</span><div style={styles.detailValue}><span style={{fontSize: '0.9em'}}>{product.aiRiskDetails}</span></div></div>}
                            <button onClick={() => { setAttributesRevealed(true); onAnalyzeProductAttributes(product.id); }} style={product.aiColor ? styles.aiActionButton : {...styles.aiActionButton, backgroundColor: PRIMARY_COLOR, color: '#fff'}} disabled={product.isAiAnalysisLoading}>{product.aiColor ? 'Re-Analyze Attributes' : 'Analyze Attributes'}</button>
                        </>
                    )
                ) : <button onClick={() => { setAttributesRevealed(true); onAnalyzeProductAttributes(product.id); }} style={{...styles.aiActionButton, backgroundColor: PRIMARY_COLOR, color: '#fff'}}>Analyze Attributes</button>}
            </div>
            <div style={styles.aiInsightsSection}>
                <h4 style={styles.aiTitle}>AI Action Shot</h4>
                {visualRevealed ? (
                    product.isAiVisualizationLoading ? <div style={styles.loadingContainer}><p style={{fontSize: '0.9em', color: PRIMARY_COLOR}}>Generating Action Shot...</p></div> : (
                        product.aiVisualizedImage ? <div style={{...styles.imageContainer, height: '300px', backgroundColor: '#000'}}><img src={product.aiVisualizedImage} alt="AI Visualized" style={styles.image} /></div> : 
                        <div style={{textAlign: 'center', padding: '20px', color: '#777'}}><p style={{marginBottom: '15px', fontSize: '0.9em'}}>Visualize this product in a professional context using AI.</p><button onClick={() => { setVisualRevealed(true); onVisualizeProduct(product.id); }} style={{...styles.aiActionButton, backgroundColor: PRIMARY_COLOR, color: '#fff'}}>Retry Generation</button></div>
                    )
                ) : <button onClick={() => { setVisualRevealed(true); onVisualizeProduct(product.id); }} style={{...styles.aiActionButton, backgroundColor: PRIMARY_COLOR, color: '#fff'}}>Generate Action Shot</button>}
            </div>
        </div>
    );
};
export default ProductCard;
