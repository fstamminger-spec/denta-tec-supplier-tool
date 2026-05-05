
import { Order, User } from '../types';
import { CORS_PROXY_URL } from '../config';

const LOGIN_API_URL = 'https://customer-partner-login-320280941237.europe-west3.run.app/login';
const ORDERS_API_URL = 'https://customer-partner-login-320280941237.europe-west3.run.app/orders';

export const authService = {
    async login(email: string, password: string): Promise<User> {
        const response = await fetch(`${CORS_PROXY_URL}${LOGIN_API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
            const data = await response.json();
            return data.user;
        } else {
             throw new Error("Invalid credentials");
        }
    },

    async fetchOrders(customerNumber: string): Promise<Order[]> {
        const response = await fetch(`${CORS_PROXY_URL}${ORDERS_API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
