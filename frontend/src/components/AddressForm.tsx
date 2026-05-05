
import React from 'react';
import { Address } from '../types';

interface AddressFormProps {
    address: Address;
    onAddressChange: (field: keyof Address, value: string) => void;
    title: string;
    disabled?: boolean;
    t: any;
    showRemoveButton?: boolean;
    onRemove?: () => void;
}

export const AddressForm: React.FC<AddressFormProps> = ({ address, onAddressChange, title, disabled = false, t, showRemoveButton, onRemove }) => {
    const PRIMARY_COLOR = "#00385F";
    const SECONDARY_COLOR = "#ED6501";
    const BORDER_COLOR = "#DDD";
    const ERROR_COLOR_TEXT = "#D32F2F";

    const styles: { [key: string]: React.CSSProperties } = {
        addressFormContainer: { border: `1px solid ${BORDER_COLOR}`, borderRadius: '8px', padding: '20px', backgroundColor: '#fdfdfd', marginBottom: '20px' },
        addressFormGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px 20px' },
        addressFormGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
        addressFormLabel: { fontSize: '0.9em', fontWeight: 500, color: PRIMARY_COLOR },
        addressFormInput: { width: '100%', padding: '8px 10px', border: `1px solid ${BORDER_COLOR}`, borderRadius: '4px', fontSize: '0.95em', boxSizing: 'border-box' },
        button: { backgroundColor: SECONDARY_COLOR, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1.05em', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textAlign: 'center', minWidth: '150px' },
        contentTitle: { color: PRIMARY_COLOR, marginTop: '0', marginBottom: '20px', borderBottom: `3px solid ${SECONDARY_COLOR}`, paddingBottom: '12px', fontSize: '1.6em' },
    };

    return (
        <div style={styles.addressFormContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <h4 style={{ ...styles.contentTitle, fontSize: '1.2em', borderBottom: `2px solid ${SECONDARY_COLOR}`, marginTop: 0, marginBottom: '15px' }}>{title}</h4>
                 {showRemoveButton && onRemove && (
                    <button onClick={onRemove} style={{...styles.button, padding: '5px 10px', fontSize: '0.9em', backgroundColor: ERROR_COLOR_TEXT, minWidth: 'auto', marginBottom: '15px' }}>
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                 )}
            </div>
            <div style={styles.addressFormGrid}>
                <div style={{ ...styles.addressFormGroup, gridColumn: '1 / -1' }}>
                    <label htmlFor={`${title}-name`} style={styles.addressFormLabel}>{t.companyName}</label>
                    <input id={`${title}-name`} type="text" value={address.name} onChange={e => onAddressChange('name', e.target.value)} style={styles.addressFormInput} disabled={disabled} />
                </div>
                <div style={{ ...styles.addressFormGroup, gridColumn: '1 / -1' }}>
                    <label htmlFor={`${title}-street`} style={styles.addressFormLabel}>{t.streetAndHouseNumber}</label>
                    <input id={`${title}-street`} type="text" value={address.street} onChange={e => onAddressChange('street', e.target.value)} style={styles.addressFormInput} disabled={disabled} />
                </div>
                <div style={styles.addressFormGroup}>
                    <label htmlFor={`${title}-zip`} style={styles.addressFormLabel}>{t.postalCode}</label>
                    <input id={`${title}-zip`} type="text" value={address.zip} onChange={e => onAddressChange('zip', e.target.value)} style={styles.addressFormInput} disabled={disabled} />
                </div>
                <div style={styles.addressFormGroup}>
                    <label htmlFor={`${title}-city`} style={styles.addressFormLabel}>{t.city} <span style={{ color: ERROR_COLOR_TEXT }}>*</span></label>
                    <input id={`${title}-city`} type="text" value={address.city} onChange={e => onAddressChange('city', e.target.value)} style={{ ...styles.addressFormInput, borderColor: !address.city ? ERROR_COLOR_TEXT : BORDER_COLOR }} required disabled={disabled} placeholder={t.cityPlaceholder} />
                </div>
                <div style={{ ...styles.addressFormGroup, gridColumn: '1 / -1' }}>
                     <label htmlFor={`${title}-country`} style={styles.addressFormLabel}>{t.country}</label>
                     <input id={`${title}-country`} type="text" value={address.country} onChange={e => onAddressChange('country', e.target.value)} style={styles.addressFormInput} disabled={disabled} />
                </div>
            </div>
        </div>
    );
};
