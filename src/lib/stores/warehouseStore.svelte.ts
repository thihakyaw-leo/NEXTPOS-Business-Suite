import { browser } from '$app/environment';
import { products } from '$lib/stores/products.svelte';

export interface WarehouseRecord {
  id: string;
  name: string;
  code: string;
  address: string;
  manager: string;
  phone: string;
  isActive: boolean;
  inventory: Record<string, number>; // productId -> quantity
}

export interface StockTransfer {
  id: string;
  date: string;
  warehouseId: string;
  itemCode: string;
  quantity: number;
  direction: 'TO_POS' | 'TO_WAREHOUSE';
  status: 'COMPLETED';
}

function createWarehouseStore() {
  let initialWarehouses: WarehouseRecord[] = [];
  let initialTransfers: StockTransfer[] = [];

  if (browser) {
    const saved = localStorage.getItem('pos_warehouses');
    const savedTransfers = localStorage.getItem('pos_wh_transfers');
    
    if (saved) {
      try {
        initialWarehouses = JSON.parse(saved);
        // Ensure legacy records have an inventory object
        initialWarehouses.forEach(w => w.inventory = w.inventory || {});
      } catch (e) {
        console.error('Failed to load warehouses', e);
      }
    }
    if (savedTransfers) {
      try { initialTransfers = JSON.parse(savedTransfers); } catch (e) { console.error(e); }
    }
    
    if (initialWarehouses.length === 0) {
      initialWarehouses = [
        { id: 'wh1', name: 'Main Warehouse', code: 'WH-MAIN', address: 'Bahan, Yangon', manager: 'U Mg Mg', phone: '09-11111111', isActive: true, inventory: {} },
        { id: 'wh2', name: 'South Dagon Branch', code: 'WH-SD', address: 'South Dagon, Yangon', manager: 'Daw Hla Hla', phone: '09-22222222', isActive: true, inventory: {} }
      ];
    }
  }

  let warehouses = $state<WarehouseRecord[]>(initialWarehouses);
  let transfers = $state<StockTransfer[]>(initialTransfers);

  function save() {
    if (browser) {
      localStorage.setItem('pos_warehouses', JSON.stringify(warehouses));
      localStorage.setItem('pos_wh_transfers', JSON.stringify(transfers));
    }
  }

  return {
    get all() { return warehouses; },
    get active() { return warehouses.filter(w => w.isActive); },
    get allTransfers() { return transfers; },
    
    add(warehouse: Omit<WarehouseRecord, 'id' | 'inventory'>) {
      const newWarehouse = { ...warehouse, id: crypto.randomUUID(), inventory: {} };
      warehouses.push(newWarehouse);
      save();
    },
    
    update(id: string, updates: Partial<WarehouseRecord>) {
      const idx = warehouses.findIndex(w => w.id === id);
      if (idx !== -1) {
        warehouses[idx] = { ...warehouses[idx], ...updates };
        save();
      }
    },
    
    remove(id: string) {
      warehouses = warehouses.filter(w => w.id !== id);
      save();
    },

    transferStock(warehouseId: string, itemCode: string, quantity: number, direction: 'TO_POS' | 'TO_WAREHOUSE') {
      const whIdx = warehouses.findIndex(w => w.id === warehouseId);
      if (whIdx === -1) throw new Error('Warehouse not found');
      
      const product = products.getByCode(itemCode);
      if (!product) throw new Error('Product not found in POS catalog');

      const wh = warehouses[whIdx];
      const whStock = wh.inventory[itemCode] || 0;

      if (direction === 'TO_POS') {
        if (whStock < quantity) throw new Error('Insufficient stock in warehouse');
        wh.inventory[itemCode] = whStock - quantity;
        products.updateProduct(product.id, { stock: product.stock + quantity });
      } else {
        if (product.stock < quantity) throw new Error('Insufficient stock in POS');
        wh.inventory[itemCode] = whStock + quantity;
        products.updateProduct(product.id, { stock: product.stock - quantity });
      }

      transfers.unshift({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        warehouseId,
        itemCode,
        quantity,
        direction,
        status: 'COMPLETED'
      });

      save();
    }
  };
}

export const warehouseStore = createWarehouseStore();
