
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DentaTecProduct, ExtractedOrderItem } from '../types';

interface ProductSearchableDropdownProps {
    products: DentaTecProduct[];
    currentItem: ExtractedOrderItem;
    onProductSelect: (product: DentaTecProduct) => void;
}

export const ProductSearchableDropdown: React.FC<ProductSearchableDropdownProps> = ({ products, currentItem, onProductSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredIndex, setHoveredIndex] = useState(-1);
    const BORDER_COLOR = "#DDD";

    useEffect(() => {
        if (currentItem.matchedProduct) {
            setSearchQuery(`${currentItem.matchedProduct.produktname || ''} (${currentItem.matchedProduct.sku})`);
        } else {
            setSearchQuery(currentItem.productName || '');
        }
    }, [currentItem.matchedProduct, currentItem.productName]);

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return [];
        // Don't filter if the query matches the selected item exactly to avoid empty list
        if (currentItem.matchedProduct && searchQuery === `${currentItem.matchedProduct.produktname || ''} (${currentItem.matchedProduct.sku})`) {
            return [];
        }
        const lowercasedQuery = searchQuery.toLowerCase();
        
        return products.filter(p => 
            (p.sku && p.sku.toLowerCase().includes(lowercasedQuery)) ||
            (p['hersteller-nr.'] && p['hersteller-nr.'].toLowerCase().includes(lowercasedQuery)) ||
            (p.produktname && p.produktname.toLowerCase().includes(lowercasedQuery))
        ).slice(0, 50); 
    }, [searchQuery, products, currentItem.matchedProduct]);

    const handleSelectProduct = (product: DentaTecProduct) => {
        onProductSelect(product);
        setIsDropdownVisible(false);
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsDropdownVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, []);

    const styles: { [key: string]: React.CSSProperties } = {
        productSearchContainer: { position: 'relative', width: '100%' },
        productSearchInput: { width: '100%', padding: '6px', boxSizing: 'border-box', border: `1px solid ${BORDER_COLOR}`, borderRadius: '4px' },
        // Increased z-index significantly to ensure it floats above other table rows
        productSearchDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: `1px solid ${BORDER_COLOR}`, borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '200px', overflowY: 'auto', zIndex: 9999, marginTop: '2px' },
        productSearchItem: { padding: '8px 10px', cursor: 'pointer', fontSize: '0.85em' },
        productSearchItemHover: { backgroundColor: '#f0f0f0' },
    };

    return (
        <div style={styles.productSearchContainer} ref={containerRef}>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={() => setIsDropdownVisible(true)} placeholder={currentItem.matchedSku ? `Current: ${currentItem.matchedSku}` : "Search by name, SKU..."} style={{ ...styles.productSearchInput, backgroundColor: currentItem.matchedSku ? '#E8F5E9' : 'transparent', border: currentItem.matchedSku ? '1px solid #4CAF50' : `1px solid ${BORDER_COLOR}`, }} autoComplete="off" />
            {isDropdownVisible && filteredProducts.length > 0 && (
                <div style={styles.productSearchDropdown}>
                    {filteredProducts.map((p, index) => (
                        <div key={p.sku} onClick={() => handleSelectProduct(p)} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(-1)} style={hoveredIndex === index ? {...styles.productSearchItem, ...styles.productSearchItemHover} : styles.productSearchItem} >
                            <strong>{p.produktname}</strong><br />
                            <small style={{color: '#555'}}>SKU: {p.sku} | Mfr No: {p['hersteller-nr.']}</small>
                        </div>
                    ))}
                </div>
            )}
            {isDropdownVisible && searchQuery && !currentItem.matchedProduct && filteredProducts.length === 0 && (
                <div style={styles.productSearchDropdown}> <div style={styles.productSearchItem}>No products found matching "{searchQuery}".</div> </div>
            )}
        </div>
    );
};
