
import React, { useEffect, useState } from 'react';
import { User, Order } from '../types';
import { authService } from '../services/authService';

interface OrderHistoryProps {
    user: User;
    t: any;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ user, t }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const PRIMARY_COLOR = "#00385F";
    const SECONDARY_COLOR = "#ED6501";
    const BORDER_COLOR = "#DDD";

    useEffect(() => {
        const loadOrders = async () => {
            if (!user.kundennummer) {
                setError("No customer number found for user.");
                return;
            }
            setIsLoading(true);
            try {
                const data = await authService.fetchOrders(user.kundennummer);
                setOrders(data);
                setError(null);
            } catch (err: any) {
                console.error("Failed to load orders", err);
                setError("Failed to load order history.");
            } finally {
                setIsLoading(false);
            }
        };

        loadOrders();
    }, [user.kundennummer]);

    const styles: { [key: string]: React.CSSProperties } = {
        container: { backgroundColor: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 6px 16px rgba(0,0,0,0.07)', width: '100%', maxWidth: '1100px', boxSizing: 'border-box' },
        title: { color: PRIMARY_COLOR, marginTop: '0', marginBottom: '20px', borderBottom: `3px solid ${SECONDARY_COLOR}`, paddingBottom: '12px', fontSize: '1.6em' },
        table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.95em' },
        th: { textAlign: 'left', padding: '12px 15px', borderBottom: `2px solid ${PRIMARY_COLOR}`, backgroundColor: '#f8f9fa', color: PRIMARY_COLOR, fontWeight: '600' },
        td: { padding: '15px', borderBottom: `1px solid ${BORDER_COLOR}`, verticalAlign: 'middle', color: '#333' },
        statusBadge: { padding: '4px 10px', borderRadius: '12px', fontSize: '0.85em', fontWeight: 'bold' },
        loading: { padding: '40px', textAlign: 'center', color: '#666', fontSize: '1.1em' },
        empty: { padding: '40px', textAlign: 'center', color: '#888', fontStyle: 'italic' },
        error: { padding: '20px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '6px', textAlign: 'center' }
    };

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s.includes('complete') || s.includes('versendet')) return '#E8F5E9'; // Green bg
        if (s.includes('pending') || s.includes('offen')) return '#FFF3E0'; // Orange bg
        if (s.includes('cancel') || s.includes('storniert')) return '#FFEBEE'; // Red bg
        return '#F5F5F5'; // Grey
    };
    
    const getStatusTextColor = (status: string) => {
         const s = status?.toLowerCase() || '';
         if (s.includes('complete') || s.includes('versendet')) return '#2E7D32';
         if (s.includes('pending') || s.includes('offen')) return '#EF6C00'; 
         if (s.includes('cancel') || s.includes('storniert')) return '#C62828';
         return '#616161';
    };

    if (isLoading) return <div style={styles.container}><div style={styles.loading}><i className="fa-solid fa-spinner fa-spin" style={{marginRight: '10px'}}></i> {t.loadingOrders}</div></div>;
    if (error) return <div style={styles.container}><div style={styles.error}>{error}</div></div>;

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>{t.orderHistory}</h2>
            {orders.length === 0 ? (
                <div style={styles.empty}>{t.noOrdersYet}</div>
            ) : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>{t.orderDetails}</th>
                            <th style={styles.th}>{t.date}</th>
                            <th style={styles.th}>{t.netRevenue}</th>
                            <th style={styles.th}>{t.status}</th>
                            <th style={styles.th}>{t.tracking}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order, idx) => (
                            <tr key={`${order.sales_order_id}-${idx}`}>
                                <td style={styles.td}>
                                    <strong>Order: {order.sales_order_id}</strong><br/>
                                    {order.external_order_number && <span style={{fontSize: '0.9em', color: '#666'}}>External: {order.external_order_number}</span>}
                                </td>
                                <td style={styles.td}>
                                    {new Date(order.date).toLocaleDateString()}
                                </td>
                                <td style={styles.td}>
                                    {order.sales_orders_net_revenue}
                                </td>
                                <td style={styles.td}>
                                    <div style={{marginBottom: '5px'}}>
                                        <span style={{...styles.statusBadge, backgroundColor: getStatusColor(order.sales_order_status), color: getStatusTextColor(order.sales_order_status)}}>
                                            Order: {order.sales_order_status}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{...styles.statusBadge, backgroundColor: getStatusColor(order.payment_status), color: getStatusTextColor(order.payment_status)}}>
                                            Payment: {order.payment_status}
                                        </span>
                                    </div>
                                    <div style={{fontSize: '0.85em', marginTop: '4px'}}>({order.invoice_status})</div>
                                </td>
                                <td style={styles.td}>
                                    {order.tracking_links ? (
                                        <a href={order.tracking_links} target="_blank" rel="noopener noreferrer" style={{color: PRIMARY_COLOR, textDecoration: 'underline'}}>
                                            {order.tracking_numbers || 'Track Package'}
                                        </a>
                                    ) : (
                                        <span style={{color: '#999'}}>Not available</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
