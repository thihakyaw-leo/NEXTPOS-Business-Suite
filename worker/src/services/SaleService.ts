import { inject, injectable } from 'inversify';
import {
  TYPES,
  type CostingMethod,
  type CreateSaleDetailInput,
  type CreateSaleHeaderInput,
  type CreateSaleInput,
  type DeliveryProviderCode,
  type DeliveryStatus,
  type ICostingService,
  type ICustomerReceivableRepository,
  type ID1Repository,
  type IR2Repository,
  type ISaleService,
  type InventoryStockRecord,
  type SaleAggregate,
  type SaleCostingLine,
  type SaleDetailRecord,
  type SalePaymentMethod,
  type SaleRecord,
  type SaleRecoveryResult,
  type SaleSnapshotPayload,
  type ValidatedSaleDetail,
} from '../interfaces.js';

type NormalizedSaleRequest = {
  sale: Omit<SaleRecord, 'id' | 'isdeleted' | 'createdate' | 'updatedate'>;
  header: CreateSaleHeaderInput;
  details: CreateSaleDetailInput[];
  invoiceNo: string;
  costingMethod: CostingMethod;
  amountPaid: number;
};

type StockReservation = {
  item_code: string;
  location_code: string;
  requested_quantity: number;
};

@injectable()
export class SaleService implements ISaleService {
  constructor(
    @inject(TYPES.D1Database) private readonly db: D1Database,
    @inject(TYPES.ID1Repository) private readonly d1: ID1Repository,
    @inject(TYPES.IR2Repository) private readonly r2: IR2Repository,
    @inject(TYPES.ICustomerReceivableRepository)
    private readonly receivables: ICustomerReceivableRepository,
    @inject(TYPES.ICostingService) private readonly costingService: ICostingService,
  ) {}

  getSales(tenantId: string): Promise<SaleRecord[]> {
    return this.d1.query<SaleRecord>(
      `SELECT *
       FROM tx_sale_sale
       WHERE tenant_id = ? AND isdeleted = 0
       ORDER BY sale_date DESC, id DESC`,
      [tenantId],
    );
  }

  async getSaleById(tenantId: string, saleId: number): Promise<SaleAggregate | null> {
    const sale = await this.d1.first<SaleRecord>(
      `SELECT *
       FROM tx_sale_sale
       WHERE id = ? AND tenant_id = ? AND isdeleted = 0`,
      [saleId, tenantId],
    );

    if (!sale) {
      return null;
    }

    const details = await this.getSaleDetails(tenantId, sale.id!);

    return { sale, details };
  }

  async getSaleByNumber(tenantId: string, saleNumber: string): Promise<SaleAggregate | null> {
    const sale = await this.d1.first<SaleRecord>(
      `SELECT *
       FROM tx_sale_sale
       WHERE tenant_id = ? AND sale_number = ? AND isdeleted = 0`,
      [tenantId, saleNumber],
    );

    if (!sale?.id) {
      return null;
    }

    const details = await this.getSaleDetails(tenantId, sale.id);

    return { sale, details };
  }

  async createSale(payload: CreateSaleInput): Promise<SaleAggregate> {
    const normalized = this.normalizeCreateSaleInput(payload);
    const validatedDetails = await this.validateCartItems(
      normalized.sale.tenant_id,
      normalized.details,
    );
    const snapshotKey = this.buildSnapshotKey(normalized.invoiceNo);
    const pendingSnapshot: SaleSnapshotPayload = {
      sale: normalized.header,
      details: normalized.details,
      snapshot_key: snapshotKey,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    await this.writeSnapshot(snapshotKey, pendingSnapshot);

    try {
      const costingPlan = await this.costingService.processSale({
        tenantId: normalized.sale.tenant_id,
        invoiceNo: normalized.invoiceNo,
        saleDate: normalized.sale.sale_date,
        method: normalized.costingMethod,
        details: validatedDetails,
      });
      const detailCostMap = this.buildDetailCostMap(costingPlan.lines);
      const batchStatements = this.buildSaleBatchTransaction(
        normalized,
        validatedDetails,
        detailCostMap,
        costingPlan.statements,
      );

      await this.d1.batch(batchStatements);

      const aggregate = await this.getSaleByNumber(
        normalized.sale.tenant_id,
        normalized.invoiceNo,
      );

      if (!aggregate) {
        throw new Error(`Sale ${normalized.invoiceNo} was inserted but could not be reloaded`);
      }

      await this.writeSnapshot(snapshotKey, {
        ...pendingSnapshot,
        status: 'COMMITTED',
        committed_at: new Date().toISOString(),
        aggregate,
      });

      return aggregate;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error('Failed to create sale');
      const recoverySnapshot = await this.markSnapshotFailed(snapshotKey, pendingSnapshot, error.message);

      if (error instanceof InventoryValidationError) {
        throw error;
      }

      throw new SalePersistenceError(
        `Failed to persist sale ${normalized.invoiceNo}`,
        snapshotKey,
        recoverySnapshot,
        error,
      );
    }
  }

  async recoverSaleSnapshot(tenantId: string, invoiceNo: string): Promise<SaleRecoveryResult> {
    const snapshotKey = this.buildSnapshotKey(invoiceNo);
    const snapshot = await this.readSnapshot(snapshotKey);

    if (snapshot && snapshot.sale.tenant_id !== tenantId) {
      return {
        snapshotKey,
        snapshot: null,
      };
    }

    return {
      snapshotKey,
      snapshot,
    };
  }

  private async getSaleDetails(tenantId: string, saleId: number): Promise<SaleDetailRecord[]> {
    return this.d1.query<SaleDetailRecord>(
      `SELECT *
       FROM tx_sale_saledetail
       WHERE sale_id = ? AND tenant_id = ? AND isdeleted = 0
       ORDER BY id ASC`,
      [saleId, tenantId],
    );
  }

  private normalizeCreateSaleInput(payload: CreateSaleInput): NormalizedSaleRequest {
    const invoiceNo = payload.sale.invoice_no?.trim() || payload.sale.sale_number?.trim();

    if (!invoiceNo) {
      throw new InventoryValidationError('sale.invoice_no or sale.sale_number is required');
    }

    const tenantId = payload.sale.tenant_id?.trim();

    if (!tenantId) {
      throw new InventoryValidationError('sale.tenant_id is required');
    }

    if (!Array.isArray(payload.details) || payload.details.length === 0) {
      throw new InventoryValidationError('At least one sale detail row is required');
    }

    const costingMethod = normalizeCostingMethod(payload.sale.costing_method);
    const saleDate = payload.sale.sale_date?.trim() || new Date().toISOString();
    const paymentMethod = normalizePaymentMethod(payload.sale.payment_method);
    const netAmount = toCurrency(payload.sale.net_amount);
    const amountPaid = payload.sale.amount_paid ?? (paymentMethod === 'CREDIT' ? 0 : netAmount);

    return {
      invoiceNo,
      costingMethod,
      amountPaid: toCurrency(amountPaid),
      header: payload.sale,
      sale: {
        tenant_id: tenantId,
        sale_number: invoiceNo,
        sale_date: saleDate,
        customer_name: payload.sale.customer_name?.trim() || null,
        customer_phone: payload.sale.customer_phone?.trim() || null,
        total_amount: toCurrency(payload.sale.total_amount),
        tax_amount: toCurrency(payload.sale.tax_amount),
        discount_amount: toCurrency(payload.sale.discount_amount),
        net_amount: netAmount,
        payment_method: paymentMethod,
        status: payload.sale.status?.trim().toUpperCase() || 'COMPLETED',
        notes: payload.sale.notes?.trim() || null,
        cashier_id: payload.sale.cashier_id?.trim() || null,
        register_id: payload.sale.register_id?.trim() || null,
        delivery_provider: normalizeDeliveryProvider(payload.sale.delivery_provider),
        delivery_tracking_id: payload.sale.delivery_tracking_id?.trim() || null,
        delivery_status: normalizeDeliveryStatus(payload.sale.delivery_status),
        delivery_fee: toCurrency(payload.sale.delivery_fee),
        delivery_cost: toCurrency(payload.sale.delivery_cost),
      },
      details: payload.details.map((detail) => ({
        item_code: detail.item_code?.trim(),
        item_name: detail.item_name?.trim(),
        barcode: detail.barcode?.trim() || null,
        location_code: detail.location_code?.trim() || 'MAIN',
        quantity: toQuantity(detail.quantity),
        unit_price: toCurrency(detail.unit_price),
        discount: toCurrency(detail.discount ?? 0),
        tax: toCurrency(detail.tax ?? 0),
        line_total: toCurrency(detail.line_total),
        cost_price: detail.cost_price,
      })),
    };
  }

  private async validateCartItems(
    tenantId: string,
    details: CreateSaleDetailInput[],
  ): Promise<ValidatedSaleDetail[]> {
    const reservations = this.buildReservations(details);
    const stockMap = new Map<string, InventoryStockRecord>();

    for (const reservation of reservations) {
      const stock = await this.d1.first<InventoryStockRecord>(
        `SELECT *
         FROM t_inventory_stock
         WHERE tenant_id = ?
           AND item_code = ?
           AND location_code = ?
           AND isdeleted = 0`,
        [tenantId, reservation.item_code, reservation.location_code],
      );

      if (!stock) {
        throw new InventoryValidationError(
          `Stock record not found for ${reservation.item_code} at ${reservation.location_code}`,
        );
      }

      if (Number(stock.quantity_on_hand) < reservation.requested_quantity) {
        throw new InventoryValidationError(
          `Insufficient stock for ${reservation.item_code}: requested ${reservation.requested_quantity}, available ${stock.quantity_on_hand}`,
        );
      }

      stockMap.set(this.buildStockKey(reservation.item_code, reservation.location_code), stock);
    }

    return details.map((detail) => {
      const key = this.buildStockKey(detail.item_code, detail.location_code ?? 'MAIN');
      const stock = stockMap.get(key);

      if (!detail.item_code || !detail.item_name) {
        throw new InventoryValidationError('Each detail row requires item_code and item_name');
      }

      if (!stock) {
        throw new InventoryValidationError(`Stock validation missing for ${detail.item_code}`);
      }

      return {
        ...detail,
        item_code: detail.item_code,
        item_name: detail.item_name,
        location_code: detail.location_code ?? 'MAIN',
        stock,
      };
    });
  }

  private buildReservations(details: CreateSaleDetailInput[]): StockReservation[] {
    const grouped = new Map<string, StockReservation>();

    for (const detail of details) {
      if (!detail.item_code?.trim()) {
        throw new InventoryValidationError('Each detail row requires item_code');
      }

      const quantity = toQuantity(detail.quantity);

      if (quantity <= 0) {
        throw new InventoryValidationError(`Quantity must be positive for ${detail.item_code}`);
      }

      const locationCode = detail.location_code?.trim() || 'MAIN';
      const key = this.buildStockKey(detail.item_code, locationCode);
      const existing = grouped.get(key);

      if (existing) {
        existing.requested_quantity = toQuantity(existing.requested_quantity + quantity);
        continue;
      }

      grouped.set(key, {
        item_code: detail.item_code,
        location_code: locationCode,
        requested_quantity: quantity,
      });
    }

    return [...grouped.values()];
  }

  private buildSaleBatchTransaction(
    normalized: NormalizedSaleRequest,
    details: ValidatedSaleDetail[],
    detailCostMap: Map<string, number>,
    costingStatements: D1PreparedStatement[],
  ): D1PreparedStatement[] {
    // Cloudflare D1 batch example: header insert, detail inserts, stock/ledger costing writes,
    // and credit receivable upsert all execute inside one transactional batch.
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO tx_sale_sale
           (tenant_id, sale_number, sale_date, customer_name, customer_phone,
            total_amount, tax_amount, discount_amount, net_amount,
            payment_method, status, notes, cashier_id, register_id,
            delivery_provider, delivery_tracking_id, delivery_status, delivery_fee, delivery_cost,
            isdeleted, createdate, updatedate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          normalized.sale.tenant_id,
          normalized.sale.sale_number,
          normalized.sale.sale_date,
          normalized.sale.customer_name ?? null,
          normalized.sale.customer_phone ?? null,
          normalized.sale.total_amount,
          normalized.sale.tax_amount,
          normalized.sale.discount_amount,
          normalized.sale.net_amount,
          normalized.sale.payment_method,
          normalized.sale.status,
          normalized.sale.notes ?? null,
          normalized.sale.cashier_id ?? null,
          normalized.sale.register_id ?? null,
          normalized.sale.delivery_provider ?? null,
          normalized.sale.delivery_tracking_id ?? null,
          normalized.sale.delivery_status ?? null,
          normalized.sale.delivery_fee ?? 0,
          normalized.sale.delivery_cost ?? 0,
          now,
          now,
        ),
    ];

    for (const detail of details) {
      const detailKey = this.buildStockKey(detail.item_code, detail.location_code);
      const unitCost = detailCostMap.get(detailKey) ?? detail.stock.avg_cost ?? detail.stock.cost_price ?? 0;

      statements.push(
        this.db
          .prepare(
            `INSERT INTO tx_sale_saledetail
             (tenant_id, sale_id, item_code, item_name, barcode,
              quantity, unit_price, discount, tax, line_total, cost_price,
              isdeleted, createdate, updatedate)
             SELECT ?, s.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?
             FROM tx_sale_sale s
             WHERE s.tenant_id = ?
               AND s.sale_number = ?`,
          )
          .bind(
            normalized.sale.tenant_id,
            detail.item_code,
            detail.item_name,
            detail.barcode ?? null,
            detail.quantity,
            detail.unit_price,
            detail.discount ?? 0,
            detail.tax ?? 0,
            detail.line_total,
            unitCost,
            now,
            now,
            normalized.sale.tenant_id,
            normalized.invoiceNo,
          ),
      );
    }

    statements.push(...costingStatements);

    const outstandingAmount = toCurrency(normalized.sale.net_amount - normalized.amountPaid);

    if (outstandingAmount > 0) {
      const customerName = normalized.sale.customer_name?.trim();
      const customerPhone = normalized.sale.customer_phone?.trim() || '';

      if (!customerName) {
        throw new InventoryValidationError('Credit sales require sale.customer_name for receivable tracking');
      }

      statements.push(
        this.receivables.buildUpsertStatement({
          tenant_id: normalized.sale.tenant_id,
          customer_name: customerName,
          customer_phone: customerPhone,
          balance_amount: outstandingAmount,
          sale_number: normalized.invoiceNo,
          createdate: now,
          updatedate: now,
        }),
      );
    }

    return statements;
  }

  private buildDetailCostMap(lines: SaleCostingLine[]): Map<string, number> {
    const lineCostMap = new Map<string, number>();

    for (const line of lines) {
      lineCostMap.set(
        this.buildStockKey(line.item_code, line.location_code),
        line.unit_cost,
      );
    }

    return lineCostMap;
  }

  private buildSnapshotKey(invoiceNo: string): string {
    return `snapshots/sales/S#${invoiceNo}.json`;
  }

  private async writeSnapshot(snapshotKey: string, payload: SaleSnapshotPayload): Promise<void> {
    await this.r2.put(
      snapshotKey,
      JSON.stringify(payload, null, 2),
      {
        httpMetadata: {
          contentType: 'application/json',
        },
      },
    );
  }

  private async readSnapshot(snapshotKey: string): Promise<SaleSnapshotPayload | null> {
    const object = await this.r2.get(snapshotKey);

    if (!object) {
      return null;
    }

    return object.json<SaleSnapshotPayload>();
  }

  private async markSnapshotFailed(
    snapshotKey: string,
    snapshot: SaleSnapshotPayload,
    reason: string,
  ): Promise<SaleSnapshotPayload | null> {
    const failedSnapshot: SaleSnapshotPayload = {
      ...snapshot,
      status: 'FAILED',
      recovery_reason: reason,
    };

    await this.writeSnapshot(snapshotKey, failedSnapshot);

    return this.readSnapshot(snapshotKey);
  }

  private buildStockKey(itemCode: string, locationCode: string): string {
    return `${itemCode}::${locationCode}`;
  }
}

export class InventoryValidationError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}

export class SalePersistenceError extends Error {
  readonly snapshotKey: string;
  readonly recoverySnapshot: SaleSnapshotPayload | null;
  readonly statusCode = 500;

  constructor(
    message: string,
    snapshotKey: string,
    recoverySnapshot: SaleSnapshotPayload | null,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'SalePersistenceError';
    this.snapshotKey = snapshotKey;
    this.recoverySnapshot = recoverySnapshot;
  }
}

function normalizeCostingMethod(value: string | undefined): CostingMethod {
  const method = value?.trim().toUpperCase() || 'FIFO';

  if (method === 'AVG' || method === 'FIFO') {
    return method;
  }

  throw new InventoryValidationError(`Unsupported costing method: ${value}`);
}

function normalizePaymentMethod(value: string | undefined): SalePaymentMethod {
  const method = value?.trim().toUpperCase() || 'CASH';

  if (
    method === 'CASH' ||
    method === 'CARD' ||
    method === 'TRANSFER' ||
    method === 'CREDIT'
  ) {
    return method;
  }

  throw new InventoryValidationError(`Unsupported payment method: ${value}`);
}

function normalizeDeliveryProvider(value: string | null | undefined): DeliveryProviderCode | null {
  const provider = value?.trim().toUpperCase();

  if (!provider) {
    return null;
  }

  if (
    provider === 'MOCK' ||
    provider === 'GRAB' ||
    provider === 'LALAMOVE' ||
    provider === 'MANUAL'
  ) {
    return provider;
  }

  throw new InventoryValidationError(`Unsupported delivery provider: ${value}`);
}

function normalizeDeliveryStatus(value: string | null | undefined): DeliveryStatus | null {
  const status = value?.trim().toUpperCase().replace(/[\s-]+/g, '_');

  if (!status) {
    return null;
  }

  switch (status) {
    case 'PENDING':
    case 'QUOTE':
    case 'ALLOCATING':
    case 'QUEUING':
    case 'PICKED_UP':
    case 'IN_TRANSIT':
    case 'DELIVERED':
    case 'CANCELLED':
    case 'FAILED':
      return status;
    default:
      throw new InventoryValidationError(`Unsupported delivery status: ${value}`);
  }
}

function toCurrency(value: number | null | undefined): number {
  return Number(Number(value ?? 0).toFixed(2));
}

function toQuantity(value: number | null | undefined): number {
  return Number(Number(value ?? 0).toFixed(4));
}
