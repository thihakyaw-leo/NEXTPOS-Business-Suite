import { tenantApiFetch, resolveTenantId } from './tenant';
import type { Product } from '$lib/types/index';

// The backend InventoryStockRecord matches our Product interface, with slight snake_case differences.
export interface InventoryStockRecord {
  id?: number;
  tenant_id: string;
  item_code: string;
  item_name: string;
  barcode?: string | null;
  category?: string | null;
  unit: string;
  location_code: string;
  quantity_on_hand: number;
  reorder_level: number;
  cost_price: number;
  selling_price: number;
}

export function mapStockToProduct(stock: InventoryStockRecord): Product {
  return {
    id: stock.id ? stock.id.toString() : stock.item_code, // Use internal ID or code as fallback fallback
    itemCode: stock.item_code,
    name: stock.item_name,
    barcode: stock.barcode || '',
    category: (stock.category as Product['category']) || 'other',
    unit: stock.unit,
    costPrice: stock.cost_price,
    sellingPrice: stock.selling_price,
    stock: stock.quantity_on_hand,
    reorderLevel: stock.reorder_level,
    icon: '📦', // Default icon for synced products
  };
}

export function mapProductToUpsert(product: Product) {
  return {
    item_code: product.itemCode,
    item_name: product.name,
    barcode: product.barcode,
    category: product.category,
    unit: product.unit,
    location_code: 'MAIN',
    quantity_on_hand: product.stock,
    reorder_level: product.reorderLevel,
    cost_price: product.costPrice,
    selling_price: product.sellingPrice,
  };
}

export async function fetchRemoteProducts(): Promise<Product[]> {
  const tenantId = resolveTenantId();
  if (!tenantId) throw new Error('Tenant ID missing');
  
  const records = await tenantApiFetch<InventoryStockRecord[]>('/api/products');
  return records.map(mapStockToProduct);
}

export async function upsertRemoteProduct(product: Product): Promise<Product> {
  const tenantId = resolveTenantId();
  if (!tenantId) throw new Error('Tenant ID missing');

  const payload = mapProductToUpsert(product);
  const record = await tenantApiFetch<InventoryStockRecord>('/api/products', {
    method: 'POST',
    body: payload,
  });

  return mapStockToProduct(record);
}

export async function deleteRemoteProduct(itemCode: string): Promise<void> {
  const tenantId = resolveTenantId();
  if (!tenantId) throw new Error('Tenant ID missing');

  await tenantApiFetch(`/api/products/${itemCode}`, {
    method: 'DELETE',
  });
}
