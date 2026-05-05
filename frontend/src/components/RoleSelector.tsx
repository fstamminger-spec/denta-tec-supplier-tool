
import React, { useState } from 'react';
import { UserRole } from '../types';

interface RoleSelectorProps {
    onRoleSelect: (role: UserRole) => void;
    onLanguageChange: (lang: 'de' | 'en') => void;
    currentLanguage: 'de' | 'en';
    t: any;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onRoleSelect, onLanguageChange, currentLanguage, t }) => {
    const [roleSellerHover, setRoleSellerHover] = useState(false);
    const [roleBuyerHover, setRoleBuyerHover] = useState(false);
    
    const PRIMARY_COLOR = "#00385F";
    const TEXT_COLOR_LIGHT = "#FFFFFF";
    const TEXT_COLOR_DARK = "#333";
    const SECONDARY_COLOR = "#ED6501";
    const BORDER_COLOR = "#DDD";

    const styles: { [key: string]: React.CSSProperties } = {
        roleSelectorContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', backgroundColor: PRIMARY_COLOR, position: 'relative' },
        roleSelectorCard: { backgroundColor: TEXT_COLOR_LIGHT, padding: '40px', borderRadius: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.07)', width: '100%', maxWidth: '800px', textAlign: 'center' },
        roleSelectorTitle: { color: PRIMARY_COLOR, fontSize: '2em', fontWeight: '600', marginBottom: '15px' },
        roleSelectorSubtitle: { color: TEXT_COLOR_DARK, fontSize: '1.1em', marginBottom: '40px' },
        roleOptionsContainer: { display: 'flex', justifyContent: 'center', gap: '30px' },
        roleOption: { flex: 1, padding: '30px', border: `2px solid ${BORDER_COLOR}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
        roleOptionHover: { borderColor: SECONDARY_COLOR, transform: 'translateY(-5px)', boxShadow: `0 8px 20px ${SECONDARY_COLOR}40` },
        roleIcon: { width: '64px', height: '64px', color: PRIMARY_COLOR },
        roleTitle: { fontSize: '1.4em', fontWeight: '600', color: PRIMARY_COLOR },
        roleDescription: { fontSize: '0.95em', color: '#555', lineHeight: 1.5 },
    };
    
    const SellerIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.roleIcon}>
            <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0L22 13.41a1 1 0 0 0 0-1.41L12 2z"></path><path d="M7 7h.01"></path>
        </svg>
    );

    const BuyerIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.roleIcon}>
            <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
    );

    const langButtonBase: React.CSSProperties = { padding: '8px 16px', border: '1px solid white', borderRadius: '6px', backgroundColor: 'transparent', color: 'white', cursor: 'pointer', fontWeight: 'bold' };
    const langButtonActive: React.CSSProperties = { backgroundColor: 'white', color: PRIMARY_COLOR };

    return (
        <div style={styles.roleSelectorContainer}>
            <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px' }}>
                <button onClick={() => onLanguageChange('de')} style={currentLanguage === 'de' ? {...langButtonBase, ...langButtonActive} : langButtonBase}>Deutsch</button>
                <button onClick={() => onLanguageChange('en')} style={currentLanguage === 'en' ? {...langButtonBase, ...langButtonActive} : langButtonBase}>English</button>
            </div>
            <div style={styles.roleSelectorCard}>
                <h1 style={styles.roleSelectorTitle}>{t.welcomeTitle}</h1>
                <p style={styles.roleSelectorSubtitle}>{t.welcomeSubtitle}</p>
                <div style={styles.roleOptionsContainer}>
                    <div style={roleSellerHover ? {...styles.roleOption, ...styles.roleOptionHover} : styles.roleOption} onClick={() => onRoleSelect('seller')} onMouseEnter={() => setRoleSellerHover(true)} onMouseLeave={() => setRoleSellerHover(false)}>
                        <SellerIcon /> <h2 style={styles.roleTitle}>{t.sellerTitle}</h2> <p style={styles.roleDescription}>{t.sellerDescription}</p>
                    </div>
                    <div style={roleBuyerHover ? {...styles.roleOption, ...styles.roleOptionHover} : styles.roleOption} onClick={() => onRoleSelect('buyer')} onMouseEnter={() => setRoleBuyerHover(true)} onMouseLeave={() => setRoleBuyerHover(false)}>
                        <BuyerIcon /> <h2 style={styles.roleTitle}>{t.buyerTitle}</h2> <p style={styles.roleDescription}>{t.buyerDescription}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
