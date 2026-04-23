import { inject, injectable } from 'inversify';
import {
  TYPES,
  type DeliveryCreateInput,
  type DeliveryCreateResponse,
  type DeliveryEstimateInput,
  type DeliveryPackageInput,
  type DeliveryProviderCode,
  type DeliveryWebhookResult,
  type DeliveryWebhookUpdate,
  type ID1Repository,
  type IDeliveryProviderFactory,
  type IDeliveryService,
  type SaleDetailRecord,
  type SaleRecord,
} from '../interfaces.js';

type DeliveryMutation = {
  provider: DeliveryProviderCode;
  trackingId?: string | null;
  status: DeliveryWebhookUpdate['status'];
  fee?: number | null;
  cost?: number | null;
};

@injectable()
export class DeliveryService implements IDeliveryService {
  constructor(
    @inject(TYPES.ID1Repository) private readonly d1: ID1Repository,
    @inject(TYPES.IDeliveryProviderFactory)
    private readonly providerFactory: IDeliveryProviderFactory,
  ) {}

  async estimate(input: DeliveryEstimateInput) {
    validateEstimateInput(input);
    const providers = this.providerFactory.getProviders(input.provider_codes);
    const quotes = await Promise.all(providers.map((provider) => provider.estimate(input)));

    return quotes
      .flat()
      .sort((left, right) => left.fee - right.fee);
  }

  async createDelivery(input: DeliveryCreateInput): Promise<DeliveryCreateResponse> {
    validateCreateInput(input);
    const sale = await this.loadSale(input.tenant_id, input.sale_id, input.sale_number);

    if (!sale?.id) {
      throw new DeliveryValidationError('Sale not found', 404);
    }

    const provider = this.providerFactory.getProvider(input.provider);
    const packages =
      input.packages && input.packages.length > 0
        ? input.packages
        : await this.buildPackagesFromSale(input.tenant_id, sale.id);
    const delivery = await provider.createDelivery({
      ...input,
      sale_id: sale.id,
      sale_number: sale.sale_number,
      packages,
      order_total: input.order_total || sale.net_amount,
    });
    const updatedSale = await this.applyMutation(sale, {
      provider: delivery.provider,
      trackingId: delivery.tracking_id,
      status: delivery.status,
      fee: delivery.fee,
      cost: delivery.cost,
    });

    return {
      sale: updatedSale,
      delivery,
    };
  }

  async handleWebhook(request: Request, payload: unknown): Promise<DeliveryWebhookResult> {
    const provider = this.providerFactory.getProvider(resolveWebhookProvider(request, payload));
    const event = await provider.parseWebhook(request, payload);

    if (!event) {
      return {
        updated: false,
        sale: null,
        event: null,
      };
    }

    const sale = await this.findSaleForWebhook(event);

    if (!sale) {
      return {
        updated: false,
        sale: null,
        event,
      };
    }

    const updatedSale = await this.applyMutation(sale, {
      provider: event.provider,
      trackingId: event.tracking_id ?? sale.delivery_tracking_id ?? null,
      status: event.status,
      fee: event.fee,
      cost: event.cost,
    });

    return {
      updated: true,
      sale: updatedSale,
      event,
    };
  }

  private async loadSale(
    tenantId: string,
    saleId?: number,
    saleNumber?: string,
  ): Promise<SaleRecord | null> {
    if (Number.isInteger(saleId) && saleId && saleId > 0) {
      return this.d1.first<SaleRecord>(
        `SELECT *
         FROM tx_sale_sale
         WHERE id = ? AND tenant_id = ? AND isdeleted = 0`,
        [saleId, tenantId],
      );
    }

    if (saleNumber?.trim()) {
      return this.d1.first<SaleRecord>(
        `SELECT *
         FROM tx_sale_sale
         WHERE sale_number = ? AND tenant_id = ? AND isdeleted = 0`,
        [saleNumber.trim(), tenantId],
      );
    }

    throw new DeliveryValidationError('sale_id or sale_number is required', 400);
  }

  private async buildPackagesFromSale(tenantId: string, saleId: number): Promise<DeliveryPackageInput[]> {
    const details = await this.d1.query<SaleDetailRecord>(
      `SELECT *
       FROM tx_sale_saledetail
       WHERE tenant_id = ? AND sale_id = ? AND isdeleted = 0
       ORDER BY id ASC`,
      [tenantId, saleId],
    );

    if (!details.length) {
      throw new DeliveryValidationError('At least one sale detail row is required to create a delivery', 400);
    }

    return details.map((detail) => ({
      name: detail.item_name,
      description: `${detail.quantity} x ${detail.item_name}`,
      quantity: Math.max(1, Math.round(detail.quantity)),
      price: detail.line_total,
      dimensions: {
        height: 10,
        width: 10,
        depth: 10,
        weight: 400,
      },
    }));
  }

  private async findSaleForWebhook(event: DeliveryWebhookUpdate): Promise<SaleRecord | null> {
    if (event.tracking_id) {
      const sale = await this.d1.first<SaleRecord>(
        `SELECT *
         FROM tx_sale_sale
         WHERE delivery_tracking_id = ? AND isdeleted = 0`,
        [event.tracking_id],
      );

      if (sale) {
        return sale;
      }
    }

    if (event.sale_number && event.tenant_id) {
      return this.d1.first<SaleRecord>(
        `SELECT *
         FROM tx_sale_sale
         WHERE sale_number = ? AND tenant_id = ? AND isdeleted = 0`,
        [event.sale_number, event.tenant_id],
      );
    }

    return null;
  }

  private async applyMutation(sale: SaleRecord, mutation: DeliveryMutation): Promise<SaleRecord> {
    if (!sale.id) {
      throw new DeliveryValidationError('Sale id is required for delivery updates', 500);
    }

    const previousFee = toCurrency(sale.delivery_fee ?? 0);
    const nextFee = toCurrency(mutation.fee ?? sale.delivery_fee ?? 0);
    const feeDelta = toCurrency(nextFee - previousFee);
    const nextCost = toCurrency(mutation.cost ?? sale.delivery_cost ?? 0);
    const now = new Date().toISOString();

    await this.d1.execute(
      `UPDATE tx_sale_sale
       SET delivery_provider = ?,
           delivery_tracking_id = ?,
           delivery_status = ?,
           delivery_fee = ?,
           delivery_cost = ?,
           total_amount = ?,
           net_amount = ?,
           updatedate = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        mutation.provider,
        mutation.trackingId ?? sale.delivery_tracking_id ?? null,
        mutation.status,
        nextFee,
        nextCost,
        toCurrency(sale.total_amount + feeDelta),
        toCurrency(sale.net_amount + feeDelta),
        now,
        sale.id,
        sale.tenant_id,
      ],
    );

    const updated = await this.d1.first<SaleRecord>(
      `SELECT *
       FROM tx_sale_sale
       WHERE id = ? AND tenant_id = ? AND isdeleted = 0`,
      [sale.id, sale.tenant_id],
    );

    if (!updated) {
      throw new DeliveryValidationError('Sale was updated but could not be reloaded', 500);
    }

    return updated;
  }
}

export class DeliveryValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'DeliveryValidationError';
    this.statusCode = statusCode;
  }
}

function validateEstimateInput(input: DeliveryEstimateInput): void {
  if (!input.tenant_id?.trim()) {
    throw new DeliveryValidationError('tenant_id is required');
  }

  if (!input.pickup?.address?.trim() || !input.dropoff?.address?.trim()) {
    throw new DeliveryValidationError('pickup.address and dropoff.address are required');
  }

  if (!Array.isArray(input.packages) || input.packages.length === 0) {
    throw new DeliveryValidationError('At least one package is required');
  }
}

function validateCreateInput(input: DeliveryCreateInput): void {
  if (!input.tenant_id?.trim()) {
    throw new DeliveryValidationError('tenant_id is required');
  }

  if (!input.pickup?.address?.trim() || !input.dropoff?.address?.trim()) {
    throw new DeliveryValidationError('pickup.address and dropoff.address are required');
  }

  if (!input.provider?.trim()) {
    throw new DeliveryValidationError('provider is required');
  }
}

function resolveWebhookProvider(request: Request, payload: unknown): DeliveryProviderCode {
  const body = asRecord(payload);
  const explicit =
    readString(body?.provider) ??
    readString(body?.delivery_provider) ??
    request.headers.get('x-delivery-provider');

  if (explicit) {
    const normalized = explicit.trim().toUpperCase();

    if (normalized === 'GRAB' || normalized === 'LALAMOVE' || normalized === 'MANUAL') {
      return normalized;
    }
  }

  if (body?.deliveryID || request.headers.has('x-grab-signature')) {
    return 'GRAB';
  }

  return 'MOCK';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toCurrency(value: number): number {
  return Number(value.toFixed(2));
}
