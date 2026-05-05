
import React, { useState } from 'react';
import { Address, ExtractedOrderItem } from '../types';
import { AddressForm } from './AddressForm';

interface OrderConfirmationProps {
    billingAddress: Address;
    shippingAddresses: Address[];
    items: ExtractedOrderItem[];
    onBillingChange: (field: keyof Address, value: string) => void;
    onShippingChange: (index: number, field: keyof Address, value: string) => void;
    onAddShipping: () => void;
    onRemoveShipping: (index: number) => void;
    onUpdateItem: (id: string, field: string, value: any) => void;
    onSubmit: (comment: string) => void;
    onBack: () => void;
    t: any;
    initialComment?: string;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ 
    billingAddress, shippingAddresses, items, onBillingChange, onShippingChange, onAddShipping, onRemoveShipping, onUpdateItem, onSubmit, onBack, t, initialComment
}) => {
    const [orderComment, setOrderComment] = useState(initialComment || '');
    const [isSameAddress, setIsSameAddress] = useState(true);

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsSameAddress(e.target.checked);
        if (e.target.checked && shippingAddresses.length === 0) {
            onAddShipping(); 
        }
    };

    const PRIMARY_COLOR = "#00385F";
    const SECONDARY_COLOR = "#ED6501";
    const BORDER_COLOR = "#DDD";

    const styles: { [key: string]: React.CSSProperties } = {
        container: { maxWidth: '1000px', margin: '0 auto' },
        header: { color: PRIMARY_COLOR, borderBottom: `2px solid ${SECONDARY_COLOR}`, paddingBottom: '10px', marginBottom: '25px' },
        section: { marginBottom: '30px' },
        checkboxLabel: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1em', fontWeight: '500', color: PRIMARY_COLOR, marginBottom: '20px', cursor: 'pointer' },
        summaryCard: { backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: `1px solid ${BORDER_COLOR}`, marginBottom: '25px' },
        summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.95em' },
        totalRow: { display: 'flex', justifyContent: 'space-between', marginTop: '15px', paddingTop: '15px', borderTop: `1px solid ${BORDER_COLOR}`, fontWeight: 'bold', fontSize: '1.2em', color: PRIMARY_COLOR },
        textArea: { width: '100%', padding: '12px', border: `1px solid ${BORDER_COLOR}`, borderRadius: '6px', minHeight: '100px', fontSize: '1em', fontFamily: 'inherit' },
        actions: { display: 'flex', justifyContent: 'space-between', marginTop: '40px' },
        button: { padding: '12px 25px', border: 'none', borderRadius: '6px', fontSize: '1.05em', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' },
        table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '0.9em', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
        th: { textAlign: 'left', padding: '12px', backgroundColor: '#f0f0f0', color: PRIMARY_COLOR, borderBottom: '2px solid #ddd' },
        td: { padding: '10px', borderBottom: '1px solid #eee' },
        addressSelect: { width: '100%', padding: '8px', borderRadius: '4px', border: `1px solid ${BORDER_COLOR}` }
    };

    // Calculate approx total
    const total = items.reduce((acc, item) => {
        const price = item.matchedProduct?.verkaufspreis || item.matchedProduct?.['letzter vk'] || 0;
        const numPrice = typeof price === 'string' ? parseFloat(price.replace(',', '.')) : price;
        return acc + (item.quantity * (isNaN(numPrice) ? 0 : numPrice));
    }, 0);

    return (
        <div style={styles.container}>
            <h2 style={styles.header}>{t.confirmYourOrder}</h2>
            
            <div style={styles.section}>
                <AddressForm 
                    title={t.billingAddress} 
                    address={billingAddress} 
                    onAddressChange={onBillingChange} 
                    t={t} 
                />
            </div>

            <div style={styles.section}>
                <label style={styles.checkboxLabel}>
                    <input type="checkbox" checked={isSameAddress} onChange={handleCheckboxChange} />
                    {t.sameAsBilling}
                </label>
            </div>

            {!isSameAddress && (
                <div style={styles.section}>
                    {shippingAddresses.map((addr, idx) => (
                        <AddressForm 
                            key={idx}
                            title={`${t.deliveryAddress} ${shippingAddresses.length > 1 ? idx + 1 : ''}`} 
                            address={addr} 
                            onAddressChange={(f, v) => onShippingChange(idx, f, v)} 
                            t={t} 
                            showRemoveButton={shippingAddresses.length > 1}
                            onRemove={() => onRemoveShipping(idx)}
                        />
                    ))}
                    <button onClick={onAddShipping} style={{...styles.button, backgroundColor: PRIMARY_COLOR, color: '#fff', fontSize: '0.9em'}}>
                        <i className="fa-solid fa-plus"></i> {t.addDeliveryAddress}
                    </button>

                    {/* Item-level Address Assignment */}
                    {shippingAddresses.length > 1 && (
                        <div style={{ marginTop: '30px' }}>
                            <h4 style={{ color: PRIMARY_COLOR, marginBottom: '10px' }}>{t.assignItemsToAddress}</h4>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>{t.productName}</th>
                                        <th style={styles.th}>{t.quantity}</th>
                                        <th style={styles.th}>{t.deliveryAddress}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.id}>
                                            <td style={styles.td}>
                                                {item.matchedProduct?.produktname || item.productName || item.productNumber}
                                                <div style={{fontSize: '0.85em', color: '#666'}}>{item.matchedSku || item.productNumber}</div>
                                            </td>
                                            <td style={styles.td}>{item.quantity}</td>
                                            <td style={styles.td}>
                                                <select 
                                                    style={styles.addressSelect}
                                                    value={item.shippingAddressIndex ?? 0}
                                                    onChange={(e) => onUpdateItem(item.id, 'shippingAddressIndex', parseInt(e.target.value))}
                                                >
                                                    {shippingAddresses.map((addr, idx) => (
                                                        <option key={idx} value={idx}>
                                                            Lieferadresse {idx + 1} ({addr.street} {addr.city})
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <div style={styles.section}>
                <h4 style={{ color: PRIMARY_COLOR, marginBottom: '10px' }}>{t.orderComment}</h4>
                <textarea 
                    value={orderComment} 
                    onChange={e => setOrderComment(e.target.value)} 
                    placeholder={t.orderCommentPlaceholder} 
                    style={styles.textArea} 
                />
            </div>

            <div style={styles.summaryCard}>
                <h3 style={{marginTop: 0, marginBottom: '15px', color: PRIMARY_COLOR}}>Order Summary</h3>
                <div style={styles.summaryRow}>
                    <span>Total Items:</span>
                    <span>{items.reduce((acc, i) => acc + i.quantity, 0)}</span>
                </div>
                <div style={styles.summaryRow}>
                    <span>Position Count:</span>
                    <span>{items.length}</span>
                </div>
                <div style={styles.totalRow}>
                    <span>Approx. Total (excl. Shipping):</span>
                    <span>{total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
            </div>

            <div style={styles.actions}>
                <button onClick={onBack} style={{...styles.button, backgroundColor: '#757575', color: '#fff'}}>
                    <i className="fa-solid fa-arrow-left"></i> {t.backToEdit}
                </button>
                <button onClick={() => onSubmit(orderComment)} style={{...styles.button, backgroundColor: '#4CAF50', color: '#fff', fontSize: '1.2em'}}>
                    <i className="fa-solid fa-paper-plane"></i> {t.submitFinalOrder}
                </button>
            </div>
        </div>
    );
};
