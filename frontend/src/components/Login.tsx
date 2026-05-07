
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
  logoUrl: string;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, logoUrl }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lockoutTime, setLockoutTime] = useState<number | null>(null);
    const [isLoginButtonHovered, setIsLoginButtonHovered] = useState(false);

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

    const styles: { [key: string]: React.CSSProperties } = {
        loginContainer: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', backgroundColor: '#f8f9fa', fontFamily: "'Inter', sans-serif",
        },
        loginCard: {
            backgroundColor: '#fff', padding: '40px 30px', borderRadius: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.07)', width: '100%', maxWidth: '450px', textAlign: 'center',
        },
        loginLogo: { height: '60px', marginBottom: '20px' },
        loginTitle: { color: '#00385F', fontSize: '1.8em', fontWeight: '600', marginBottom: '30px' },
        loginForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
        loginInput: { width: '100%', padding: '14px 15px', border: `1px solid #DDD`, borderRadius: '6px', fontSize: '1em', boxSizing: 'border-box' },
        loginButton: { backgroundColor: '#ED6501', color: '#fff', padding: '14px 25px', border: 'none', borderRadius: '6px', fontSize: '1.1em', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.3s ease', marginTop: '10px', width: '100%' },
        buttonHover: { backgroundColor: '#D95400' },
        buttonDisabled: { backgroundColor: '#BDBDBD', cursor: 'not-allowed' },
        loginError: { color: '#D32F2F', marginTop: '15px', minHeight: '20px', textAlign: 'center', fontSize: '0.9em', fontWeight: '500' },
    };

    useEffect(() => {
        const checkLockout = () => {
            const lockoutData = localStorage.getItem('loginLockout');
            if (lockoutData) {
                const { expiry } = JSON.parse(lockoutData);
                const remaining = expiry - new Date().getTime();
                if (remaining > 0) {
                    setLockoutTime(remaining);
                    const timer = setTimeout(() => {
                        setLockoutTime(null);
                        localStorage.removeItem('loginLockout');
                        localStorage.removeItem('loginAttempts');
                    }, remaining);
                    return () => clearTimeout(timer);
                } else {
                    localStorage.removeItem('loginLockout');
                    localStorage.removeItem('loginAttempts');
                }
            }
        };
        checkLockout();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || lockoutTime) return;

        setIsLoading(true);
        setError(null);

        try {
            const { user, token } = await authService.login(email, password);
            localStorage.removeItem('loginAttempts');
            localStorage.removeItem('loginLockout');
            onLoginSuccess(user, token);
        } catch (err: any) {
            const attemptsData = JSON.parse(localStorage.getItem('loginAttempts') || '{"count": 0}');
            const currentAttempts = attemptsData.count + 1;

            if (currentAttempts >= MAX_ATTEMPTS) {
                const expiry = new Date().getTime() + LOCKOUT_DURATION_MS;
                localStorage.setItem('loginLockout', JSON.stringify({ expiry }));
                setLockoutTime(LOCKOUT_DURATION_MS);
                 setTimeout(() => {
                    setLockoutTime(null);
                    localStorage.removeItem('loginLockout');
                    localStorage.removeItem('loginAttempts');
                }, LOCKOUT_DURATION_MS);
            } else {
                localStorage.setItem('loginAttempts', JSON.stringify({ count: currentAttempts }));
                const remaining = MAX_ATTEMPTS - currentAttempts;
                setError(`Invalid email or password. You have ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const getLockoutMessage = () => {
        if (!lockoutTime) return '';
        const minutes = Math.ceil(lockoutTime / 60000);
        return `Too many failed attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    };

    return (
        <div style={styles.loginContainer}>
            <div style={styles.loginCard}>
                <img src={logoUrl} alt="DentaTec Logo" style={styles.loginLogo} />
                <h1 style={styles.loginTitle}>Partner Login</h1>
                <form onSubmit={handleSubmit} style={styles.loginForm}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required disabled={!!lockoutTime || isLoading} style={styles.loginInput} />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required disabled={!!lockoutTime || isLoading} style={styles.loginInput} />
                    <button type="submit" disabled={!!lockoutTime || isLoading} style={ (!!lockoutTime || isLoading) ? { ...styles.loginButton, ...styles.buttonDisabled } : isLoginButtonHovered ? { ...styles.loginButton, ...styles.buttonHover } : styles.loginButton } onMouseEnter={() => setIsLoginButtonHovered(true)} onMouseLeave={() => setIsLoginButtonHovered(false)}>
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>
                <div style={styles.loginError} role="alert">
                    {lockoutTime ? getLockoutMessage() : error}
                </div>
            </div>
        </div>
    );
};
