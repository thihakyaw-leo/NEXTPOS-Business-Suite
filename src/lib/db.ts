import Dexie, { type EntityTable } from 'dexie';
import type { DeliveryProvider, DeliveryStatus, PaymentMethod, Product } from '$lib/types/index';

export type OfflineSaleStatus = 'PENDING' | 'SYNCED' | 'CONFLICT';
export type OfflineSaleErrorKind = 'NETWORK' | 'SERVER' | 'AUTH' | 'VALIDATION' | 'STOCK' | 'UNKNOWN';
export type CostingMethod = 'AVG' | 'FIFO';

export interface OfflineSaleDetailPayload {
  item_code: string;
  item_name: string;
  barcode?: string | null;
  location_code?: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax?: number;
  line_total: number;
  cost_price?: number;
}

export interface OfflineSaleHeaderPayload {
  tenant_id: string;
  sale_number?: string;
  invoice_no?: string;
  sale_date: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  net_amount: number;
  payment_method: PaymentMethod;
  status: string;
  notes?: string | null;
  cashier_id?: string | null;
  register_id?: string | null;
  delivery_provider?: DeliveryProvider | null;
  delivery_tracking_id?: string | null;
  delivery_status?: DeliveryStatus | null;
  delivery_fee?: number;
  delivery_cost?: number;
  amount_paid?: number;
  costing_method?: CostingMethod;
}

export interface OfflineSalePayload {
  sale: OfflineSaleHeaderPayload;
  details: OfflineSaleDetailPayload[];
}

export interface OfflineSaleConflictDetails {
  kind: OfflineSaleErrorKind;
  message: string;
  statusCode: number | null;
  requiresManagerReview: boolean;
  responseBody?: Record<string, unknown> | null;
  detectedAt: string;
}

export interface OfflineSaleRecord {
  id?: number;
  queueId: string;
  saleNumber: string;
  tenantId: string;
  status: OfflineSaleStatus;
  payload: OfflineSalePayload;
  lastError: string | null;
  lastHttpStatus?: number | null;
  errorKind?: OfflineSaleErrorKind | null;
  requiresManagerReview: boolean;
  conflictDetails?: OfflineSaleConflictDetails | null;
  retryCount: number;
  queuedAt: string;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string | null;
  syncedAt?: string | null;
}

class KTPOSDexie extends Dexie {
  offline_sales!: EntityTable<OfflineSaleRecord, 'id'>;
  products!: EntityTable<Product, 'id'>;

  constructor() {
    super('KT POS-offline-db');

    this.version(1).stores({
      offline_sales: '++id, &saleNumber, tenantId, status, createdAt, updatedAt, [tenantId+status]',
    });

    this.version(2)
      .stores({
        offline_sales:
          '++id, &queueId, &saleNumber, tenantId, status, errorKind, requiresManagerReview, queuedAt, createdAt, updatedAt, lastAttemptAt, syncedAt, [tenantId+status]',
      })
      .upgrade(async (tx) => {
        // Migration logic for offline_sales version 2...
        await tx.table('offline_sales').toCollection().modify((record: Partial<OfflineSaleRecord>) => {
          const saleNumber =
            record.saleNumber ??
            record.payload?.sale.invoice_no ??
            record.payload?.sale.sale_number ??
            `offline-${record.id ?? Date.now()}`;
          const createdAt = record.createdAt ?? record.updatedAt ?? new Date().toISOString();

          record.queueId = record.queueId ?? buildQueueId(saleNumber);
          record.saleNumber = saleNumber;
          record.tenantId = record.tenantId ?? record.payload?.sale.tenant_id ?? '';
          record.status = record.status ?? 'PENDING';
          record.retryCount = record.retryCount ?? 0;
          record.lastError = record.lastError ?? null;
          record.lastHttpStatus = record.lastHttpStatus ?? null;
          record.errorKind = record.errorKind ?? null;
          record.requiresManagerReview = record.requiresManagerReview ?? record.status === 'CONFLICT';
          record.conflictDetails = record.conflictDetails ?? null;
          record.queuedAt = record.queuedAt ?? createdAt;
          record.createdAt = createdAt;
          record.updatedAt = record.updatedAt ?? createdAt;
          record.lastAttemptAt = record.lastAttemptAt ?? null;
          record.syncedAt = record.syncedAt ?? null;
        });
      });

    this.version(3).stores({
      products: 'id, &itemCode, barcode, category, name',
    });
  }
}

function buildQueueId(saleNumber: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `offline-sale-${saleNumber}-${crypto.randomUUID()}`;
  }

  return `offline-sale-${saleNumber}-${Date.now().toString(36)}`;
}

export const KTPOSDb = new KTPOSDexie();
