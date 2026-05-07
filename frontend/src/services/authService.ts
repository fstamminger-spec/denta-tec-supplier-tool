
import { Order, User } from '../types';
import { BACKEND_URL } from '../config';

const TOKEN_KEY = 'authToken';

export function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export const authService = {
    async login(email: string, password: string): Promise<{ user: User; token: string }> {
        const response = await fetch(`${BACKEND_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
            const data = await response.json();
            setToken(data.token);
            return { user: data.user, token: data.token };
        } else {
            throw new Error("Invalid credentials");
        }
    },

    async fetchOrders(customerNumber: string): Promise<Order[]> {
        const response = await fetch(`${BACKEND_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ customer_number: customerNumber }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch orders.' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const ordersData: Order[] = await response.json();
        ordersData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return ordersData;
    }
};
