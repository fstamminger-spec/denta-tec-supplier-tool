
import React from 'react';
import { ExtractedOrderItem, DentaTecProduct } from '../types';
import { ProductSearchableDropdown } from './ProductSearchableDropdown';

interface MassOrderReviewProps {
    items: ExtractedOrderItem[];
    catalog: DentaTecProduct[];
    onUpdateItem: (id: string, field: string, value: any) => void;
    onDeleteItem: (id: string) => void;
    onAddRow: () => void;
    onConfirm: () => void;
    onClear: () => void;
    t: any;
    comment: string;
    onCommentChange: (val: string) => void;
    externalOrderNumber: string;
    onExternalOrderNumberChange: (val: string) => void;
}

export const MassOrderReview: React.FC<MassOrderReviewProps> = ({ 
    items, catalog, onUpdateItem, onDeleteItem, onAddRow, onConfirm, onClear, 
    t, comment, onCommentChange, externalOrderNumber, onExternalOrderNumberChange 
}) => {
    const PRIMARY_COLOR = "#00385F";
    const SECONDARY_COLOR = "#ED6501";
    const BORDER_COLOR = "#DDD";
    const ERROR_COLOR_TEXT = "#D32F2F";

    const styles: { [key: string]: React.CSSProperties } = {
        table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '0.9em', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
        th: { textAlign: 'left', padding: '15px', borderBottom: `2px solid #eee`, backgroundColor: '#f9fafb', color: PRIMARY_COLOR, fontWeight: '600' },
        td: { padding: '12px 15px', borderBottom: `1px solid #f0f0f0`, verticalAlign: 'middle' },
        input: { width: '100%', padding: '8px', border: `1px solid ${BORDER_COLOR}`, borderRadius: '4px', boxSizing: 'border-box' },
        textArea: { width: '100%', padding: '8px', border: `1px solid ${BORDER_COLOR}`, borderRadius: '4px', boxSizing: 'border-box', fontFamily: 'inherit', minHeight: '80px', marginTop: '5px' },
        iconBtn: { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1em' },
        button: { backgroundColor: SECONDARY_COLOR, color: '#fff', padding: '12px 25px', border: 'none', borderRadius: '6px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' },
        actionRow: { display: 'flex', justifyContent: 'space-between', marginTop: '20px' },
        spinner: { color: SECONDARY_COLOR, animation: 'spin 1s linear infinite' },
        sectionLabel: { display: 'block', fontWeight: '600', color: PRIMARY_COLOR, marginBottom: '5px' }
    };

    const getStockStatus = (item: ExtractedOrderItem) => {
        if (!item.matchedProduct) return null;
        return (
            <span title={t.fastDeliveryTooltip} style={{ color: '#4CAF50', fontSize: '1.2em' }}>
                <i className="fa-solid fa-truck-fast"></i>
            </span>
        );
    };

    return (
        <div>
            <h2 style={{ color: PRIMARY_COLOR, borderBottom: `2px solid ${SECONDARY_COLOR}`, paddingBottom: '10px', marginBottom: '20px' }}>
                {t.reviewInstructions}
            </h2>

            <div style={{marginBottom: '20px'}}>
                <label style={styles.sectionLabel}>{t.yourOrderNumber}</label>
                <input 
                    type="text" 
                    value={externalOrderNumber} 
                    onChange={e => onExternalOrderNumberChange(e.target.value)} 
                    style={{...styles.input, maxWidth: '300px'}} 
                    placeholder="Optional"
                />
            </div>

            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={{...styles.th, width: '15%'}}>{t.productNumber}</th>
                        <th style={{...styles.th, width: '20%'}}>{t.productName}</th>
                        <th style={{...styles.th, width: '10%'}}>{t.brand}</th>
                        <th style={{...styles.th, width: '25%'}}>{t.matchedProduct}</th>
                        <th style={{...styles.th, width: '5%', textAlign: 'center'}}>{t.info}</th>
                        <th style={{...styles.th, width: '10%'}}>{t.quantity}</th>
                        <th style={{...styles.th, width: '10%'}}>{t.pricePerUnit}</th>
                        <th style={{...styles.th, width: '5%', textAlign: 'center'}}>{t.actions}</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr key={item.id} style={{ backgroundColor: item.matchedSku ? '#fff' : '#fff8f8' }}>
                            <td style={styles.td}>
                                <input 
                                    type="text" 
                                    value={item.productNumber} 
                                    onChange={(e) => onUpdateItem(item.id, 'productNumber', e.target.value)} 
                                    style={styles.input} 
                                />
                            </td>
                            <td style={styles.td}>
                                <input 
                                    type="text" 
                                    value={item.productName || ''} 
                                    onChange={(e) => onUpdateItem(item.id, 'productName', e.target.value)} 
                                    style={styles.input} 
                                />
                            </td>
                            <td style={styles.td}>
                                {item.matchedProduct?.marke || '-'}
                            </td>
                            <td style={styles.td}>
                                {item.isAiMatching ? (
                                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontStyle: 'italic'}}>
                                        <i className="fa-solid fa-spinner" style={styles.spinner}></i>
                                        {t.matching}
                                    </div>
                                ) : (
                                    <ProductSearchableDropdown 
                                        products={catalog}
                                        currentItem={item}
                                        onProductSelect={(prod) => onUpdateItem(item.id, 'productSelect', prod)}
                                    />
                                )}
                            </td>
                            <td style={{...styles.td, textAlign: 'center'}}>
                                {getStockStatus(item)}
                            </td>
                            <td style={styles.td}>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={item.quantity} 
                                    onChange={(e) => onUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} 
                                    style={styles.input} 
                                />
                            </td>
                            <td style={styles.td}>
                                {item.matchedProduct ? `${item.matchedProduct.verkaufspreis || item.matchedProduct['letzter vk'] || '-'} €` : '-'}
                            </td>
                            <td style={{...styles.td, textAlign: 'center'}}>
                                <button onClick={() => onDeleteItem(item.id)} style={{...styles.iconBtn, color: ERROR_COLOR_TEXT, backgroundColor: '#ffebee', padding: '6px 10px', borderRadius: '4px'}}>
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={styles.actionRow}>
                <button onClick={onAddRow} style={{...styles.button, backgroundColor: PRIMARY_COLOR}}>
                    <i className="fa-solid fa-plus"></i> {t.addRow}
                </button>
            </div>
            
            <div style={{marginTop: '20px'}}>
                <label style={styles.sectionLabel}>Comments / Special Instructions / Unmatched Info:</label>
                <textarea 
                    value={comment} 
                    onChange={e => onCommentChange(e.target.value)} 
                    style={styles.textArea} 
                    placeholder="Extracted notes from the invoice or add your own..."
                />
            </div>

            <div style={{marginTop: '30px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', color: '#0d47a1', fontSize: '0.95em'}}>
                <i className="fa-solid fa-circle-info" style={{marginRight: '8px'}}></i>
                {t.shippingFeesNote}
            </div>

            <div style={{...styles.actionRow, marginTop: '30px', borderTop: `1px solid ${BORDER_COLOR}`, paddingTop: '20px'}}>
                <button onClick={onClear} style={{...styles.button, backgroundColor: '#757575'}}>
                    <i className="fa-solid fa-rotate-left"></i> {t.startOver}
                </button>
                <button onClick={onConfirm} style={{...styles.button, backgroundColor: '#4CAF50', fontSize: '1.1em'}}>
                    <i className="fa-solid fa-check-circle"></i> {t.reviewAndConfirm}
                </button>
            </div>
        </div>
    );
};
