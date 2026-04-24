import { browser } from '$app/environment';

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  purchaseDate: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

function createPurchaseStore() {
  let initialSuppliers: Supplier[] = [];
  let initialInvoices: PurchaseInvoice[] = [];

  if (browser) {
    const savedSuppliers = localStorage.getItem('pos_suppliers');
    const savedInvoices = localStorage.getItem('pos_purchase_invoices');
    
    if (savedSuppliers) {
      try {
        initialSuppliers = JSON.parse(savedSuppliers);
      } catch (e) {
        console.error('Failed to parse suppliers', e);
      }
    }
    if (savedInvoices) {
      try {
        initialInvoices = JSON.parse(savedInvoices);
      } catch (e) {
        console.error('Failed to parse invoices', e);
      }
    }

    if (initialSuppliers.length === 0) {
      initialSuppliers = [
        { id: 's1', name: 'Global Trading Co.', phone: '09-111111' },
        { id: 's2', name: 'Local Supply Hub', phone: '09-222222' }
      ];
    }
    
    if (initialInvoices.length === 0) {
      initialInvoices = [
        { id: 'p1', invoiceNumber: 'PUR-8801', supplierId: 's1', supplierName: 'Global Trading Co.', totalAmount: 1250000, purchaseDate: new Date().toISOString(), status: 'COMPLETED' },
        { id: 'p2', invoiceNumber: 'PUR-8802', supplierId: 's2', supplierName: 'Local Supply Hub', totalAmount: 450000, purchaseDate: new Date().toISOString(), status: 'PENDING' }
      ];
    }
  }

  let suppliers = $state<Supplier[]>(initialSuppliers);
  let invoices = $state<PurchaseInvoice[]>(initialInvoices);

  function save() {
    if (browser) {
      localStorage.setItem('pos_suppliers', JSON.stringify(suppliers));
      localStorage.setItem('pos_purchase_invoices', JSON.stringify(invoices));
    }
  }

  return {
    get allInvoices() { return invoices; },
    get allSuppliers() { return suppliers; },
    
    addInvoice(invoice: Omit<PurchaseInvoice, 'id'>) {
      const newInvoice = { ...invoice, id: crypto.randomUUID() };
      invoices.unshift(newInvoice);
      save();
    },
    
    addSupplier(supplier: Omit<Supplier, 'id'>) {
      const newSupplier = { ...supplier, id: crypto.randomUUID() };
      suppliers.push(newSupplier);
      save();
    },

    updateInvoiceStatus(id: string, status: PurchaseInvoice['status']) {
      const idx = invoices.findIndex(i => i.id === id);
      if (idx !== -1) {
        invoices[idx].status = status;
        save();
      }
    }
  };
}

export const purchaseStore = createPurchaseStore();
