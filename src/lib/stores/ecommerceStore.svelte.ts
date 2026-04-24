import { browser } from '$app/environment';

export type EcommerceOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';

export interface EcommerceOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  totalAmount: number;
  orderDate: string;
  status: EcommerceOrderStatus;
  paymentStatus: PaymentStatus;
  source: string; // e.g. 'Website', 'Facebook', 'App'
}

function createEcommerceStore() {
  let initialOrders: EcommerceOrder[] = [];

  if (browser) {
    const saved = localStorage.getItem('pos_ecommerce_orders');
    if (saved) {
      try {
        initialOrders = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load ecommerce orders', e);
      }
    }
    
    if (initialOrders.length === 0) {
      initialOrders = [
        { id: 'ec1', orderNumber: 'WEB-1001', customerName: 'Ko Kyaw Kyaw', phone: '09-111222333', totalAmount: 45000, orderDate: new Date().toISOString(), status: 'PENDING', paymentStatus: 'PAID', source: 'Website' },
        { id: 'ec2', orderNumber: 'FB-5022', customerName: 'Ma Hla Hla', phone: '09-444555666', totalAmount: 12500, orderDate: new Date().toISOString(), status: 'CONFIRMED', paymentStatus: 'UNPAID', source: 'Facebook' },
        { id: 'ec3', orderNumber: 'APP-990', customerName: 'U Ba', phone: '09-777888999', totalAmount: 89000, orderDate: new Date().toISOString(), status: 'PROCESSING', paymentStatus: 'PAID', source: 'Mobile App' }
      ];
    }
  }

  let orders = $state<EcommerceOrder[]>(initialOrders);

  function save() {
    if (browser) {
      localStorage.setItem('pos_ecommerce_orders', JSON.stringify(orders));
    }
  }

  return {
    get all() { return orders; },
    
    updateStatus(id: string, status: EcommerceOrderStatus) {
      const idx = orders.findIndex(o => o.id === id);
      if (idx !== -1) {
        orders[idx].status = status;
        save();
      }
    },
    
    updatePaymentStatus(id: string, status: PaymentStatus) {
      const idx = orders.findIndex(o => o.id === id);
      if (idx !== -1) {
        orders[idx].paymentStatus = status;
        save();
      }
    },
    
    remove(id: string) {
      orders = orders.filter(o => o.id !== id);
      save();
    }
  };
}

export const ecommerceStore = createEcommerceStore();
