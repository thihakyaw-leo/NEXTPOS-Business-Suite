import { inject, injectable } from 'inversify';
import {
  TYPES,
  type DeliveryCreateInput,
  type DeliveryCreateResult,
  type DeliveryDimensions,
  type DeliveryEstimateInput,
  type DeliveryEstimateQuote,
  type DeliveryPackageInput,
  type DeliveryPartyInput,
  type DeliveryWebhookUpdate,
  type IDeliveryProvider,
} from '../interfaces.js';
import type { Env } from '../types.js';

type GrabTokenCache = {
  token: string;
  expiresAt: number;
};

let cachedToken: GrabTokenCache | null = null;

@injectable()
export class GrabProvider implements IDeliveryProvider {
  readonly code = 'GRAB' as const;

  constructor(@inject(TYPES.Env) private readonly env: Env) {}

  async estimate(input: DeliveryEstimateInput): Promise<DeliveryEstimateQuote[]> {
    if (!this.canUseLiveApi(input)) {
      return [this.buildFallbackQuote(input, 'Using simulated Grab quote because credentials or coordinates are unavailable.')];
    }

    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl()}/v1/deliveries/quotes`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'cache-control': 'no-cache',
          'content-type': 'application/json',
        },
        body: JSON.stringify(this.buildQuotePayload(input)),
      });
      const result = (await response.json().catch(() => null)) as GrabQuoteResponse | null;

      if (!response.ok || !result?.quotes?.length) {
        throw new Error(result?.message ?? `Grab quote request failed with ${response.status}`);
      }

      return result.quotes.map((quote) => ({
        provider: this.code,
        service_type: quote.service?.type ?? 'INSTANT',
        fee: toCurrency(quote.amount ?? 0),
        currency: quote.currency?.code ?? normalizeCurrency(input.currency),
        estimated_pickup_at: quote.estimatedTimeline?.pickup ?? null,
        estimated_dropoff_at: quote.estimatedTimeline?.dropoff ?? null,
        distance_m: quote.distance ?? null,
        message: null,
        meta: {
          request_id: response.headers.get('x-grabkit-grab-requestid'),
        },
      }));
    } catch (error) {
      console.warn('Falling back to simulated Grab quote', error);
      return [this.buildFallbackQuote(input, 'Using simulated Grab quote because the live provider is unavailable.')];
    }
  }

  async createDelivery(input: DeliveryCreateInput): Promise<DeliveryCreateResult> {
    const normalizedInput: DeliveryCreateInput = {
      ...input,
      packages: input.packages ?? [],
    };

    if (!this.canUseLiveApi(normalizedInput)) {
      return this.buildFallbackCreate(
        normalizedInput,
        'Using simulated Grab booking because credentials or coordinates are unavailable.',
      );
    }

    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl()}/v1/deliveries`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'cache-control': 'no-cache',
          'content-type': 'application/json',
        },
        body: JSON.stringify(this.buildCreatePayload(normalizedInput)),
      });
      const result = (await response.json().catch(() => null)) as GrabCreateResponse | null;

      if (!response.ok || !result?.deliveryID) {
        throw new Error(result?.message ?? `Grab create request failed with ${response.status}`);
      }

      const fee = toCurrency(result.quote?.amount ?? normalizedInput.quoted_fee ?? 0);

      return {
        provider: this.code,
        tracking_id: result.deliveryID,
        status: normalizeGrabStatus(result.status ?? 'ALLOCATING'),
        fee,
        cost: fee,
        tracking_url:
          result.trackingURL ??
          result.trackingUrl ??
          `https://grab.com/track/${encodeURIComponent(result.deliveryID)}`,
        waybill_no: result.deliveryID,
        meta: {
          merchant_order_id: result.merchantOrderID ?? input.sale_number ?? null,
          request_id: response.headers.get('x-grabkit-grab-requestid'),
        },
      };
    } catch (error) {
      console.warn('Falling back to simulated Grab booking', error);
      return this.buildFallbackCreate(
        normalizedInput,
        'Using simulated Grab booking because the live provider is unavailable.',
      );
    }
  }

  async parseWebhook(_request: Request, payload: unknown): Promise<DeliveryWebhookUpdate | null> {
    const body = asRecord(payload);

    if (!body) {
      return null;
    }

    const deliveryRecord = asRecord(body.delivery);
    const orderRecord = asRecord(body.order);
    const trackingId =
      readString(body.deliveryID) ??
      readString(body.delivery_id) ??
      readString(deliveryRecord?.deliveryID) ??
      readString(deliveryRecord?.id);

    const saleNumber =
      readString(body.merchantOrderID) ??
      readString(body.merchant_order_id) ??
      readString(orderRecord?.merchantOrderID);

    const rawStatus =
      readString(body.status) ??
      readString(body.deliveryStatus) ??
      readString(body.delivery_status) ??
      readString(deliveryRecord?.status) ??
      'IN_TRANSIT';

    if (!trackingId && !saleNumber) {
      return null;
    }

    return {
      provider: this.code,
      tracking_id: trackingId,
      sale_number: saleNumber,
      tenant_id: readString(body.tenant_id),
      status: normalizeGrabStatus(rawStatus),
      fee: readNumber(body.amount) ?? readNumber(asRecord(body.quote)?.amount),
      cost: readNumber(body.cost),
      meta: body,
    };
  }

  private canUseLiveApi(input: DeliveryEstimateInput | DeliveryCreateInput): boolean {
    return Boolean(
      this.env.GRAB_CLIENT_ID?.trim() &&
        this.env.GRAB_CLIENT_SECRET?.trim() &&
        typeof input.pickup.latitude === 'number' &&
        typeof input.pickup.longitude === 'number' &&
        typeof input.dropoff.latitude === 'number' &&
        typeof input.dropoff.longitude === 'number',
    );
  }

  private baseUrl(): string {
    return (
      this.env.GRAB_API_BASE_URL?.trim() ||
      (this.env.ENVIRONMENT === 'production'
        ? 'https://partner-api.grab.com/grab-express'
        : 'https://partner-api.grab.com/grab-express-sandbox')
    );
  }

  private async getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
      return cachedToken.token;
    }

    const response = await fetch('https://partner-api.grab.com/grabid/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'cache-control': 'no-cache',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.env.GRAB_CLIENT_ID,
        client_secret: this.env.GRAB_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'grab_express.partner_deliveries',
      }),
    });
    const result = (await response.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number }
      | null;

    if (!response.ok || !result?.access_token) {
      throw new Error(`Unable to fetch Grab OAuth token (${response.status})`);
    }

    cachedToken = {
      token: result.access_token,
      expiresAt: Date.now() + Math.max(60, result.expires_in ?? 3600) * 1000,
    };

    return cachedToken.token;
  }

  private buildQuotePayload(input: DeliveryEstimateInput): Record<string, unknown> {
    return {
      serviceType: 'INSTANT',
      vehicleType: 'BIKE',
      paymentMethod: 'CASHLESS',
      packages: input.packages.map((entry) => this.mapPackage(entry)),
      origin: this.mapLocation(input.pickup),
      destination: this.mapLocation(input.dropoff),
    };
  }

  private buildCreatePayload(input: DeliveryCreateInput): Record<string, unknown> {
    const packages = input.packages ?? [];

    return {
      merchantOrderID: input.sale_number ?? `SALE-${Date.now()}`,
      serviceType: 'INSTANT',
      vehicleType: 'BIKE',
      codType: 'REGULAR',
      paymentMethod: 'CASHLESS',
      highValue: input.order_total >= 150000,
      packages: packages.map((entry) => this.mapPackage(entry)),
      origin: this.mapLocation(input.pickup),
      destination: this.mapLocation(input.dropoff),
      sender: this.mapParty(input.pickup, {
        name: this.env.GRAB_SENDER_NAME,
        email: this.env.GRAB_SENDER_EMAIL,
        phone: this.env.GRAB_SENDER_PHONE,
      }),
      recipient: this.mapParty(input.dropoff),
    };
  }

  private mapLocation(party: DeliveryPartyInput): Record<string, unknown> {
    return {
      address: party.address,
      keywords: party.keywords ?? undefined,
      cityCode: party.city_code ?? this.env.GRAB_CITY_CODE ?? undefined,
      coordinates: {
        latitude: party.latitude,
        longitude: party.longitude,
      },
    };
  }

  private mapParty(
    party: DeliveryPartyInput,
    fallback?: { name?: string; email?: string; phone?: string },
  ): Record<string, unknown> {
    const resolvedName = party.name || fallback?.name || 'NextPOS';
    const [firstName, ...rest] = resolvedName.trim().split(/\s+/);

    return {
      firstName: firstName || 'NextPOS',
      lastName: rest.join(' ') || undefined,
      companyName: party.company_name ?? undefined,
      email: party.email ?? fallback?.email ?? 'no-reply@nextpos.local',
      phone: sanitizePhone(party.phone || fallback?.phone || ''),
      smsEnabled: true,
      instruction: party.notes ?? undefined,
    };
  }

  private mapPackage(entry: DeliveryPackageInput): Record<string, unknown> {
    return {
      name: entry.name,
      description: entry.description,
      quantity: entry.quantity,
      price: entry.price ?? 0,
      dimensions: this.normalizeDimensions(entry.dimensions),
    };
  }

  private normalizeDimensions(value?: Partial<DeliveryDimensions>): DeliveryDimensions {
    return {
      height: Math.max(0, Math.round(value?.height ?? 10)),
      width: Math.max(0, Math.round(value?.width ?? 10)),
      depth: Math.max(0, Math.round(value?.depth ?? 10)),
      weight: Math.max(0, Math.round(value?.weight ?? 400)),
    };
  }

  private buildFallbackQuote(input: DeliveryEstimateInput, message: string): DeliveryEstimateQuote {
    const distanceKm = input.distance_km ?? 4;
    const fee = toCurrency(2200 + distanceKm * 550 + input.order_total * 0.0125);

    return {
      provider: this.code,
      service_type: 'INSTANT',
      fee,
      currency: normalizeCurrency(input.currency),
      estimated_pickup_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      estimated_dropoff_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      distance_m: Math.round(distanceKm * 1000),
      message,
      meta: {
        adapter: 'simulated',
      },
    };
  }

  private buildFallbackCreate(input: DeliveryCreateInput, message: string): DeliveryCreateResult {
    const fee = toCurrency(input.quoted_fee ?? (2200 + (input.distance_km ?? 4) * 550));
    const trackingId = `GRAB-SIM-${Date.now()}`;

    return {
      provider: this.code,
      tracking_id: trackingId,
      status: 'ALLOCATING',
      fee,
      cost: fee,
      tracking_url: `https://grab.com/track/${trackingId}`,
      waybill_no: trackingId,
      meta: {
        adapter: 'simulated',
        message,
      },
    };
  }
}

type GrabQuoteResponse = {
  message?: string;
  quotes?: Array<{
    service?: {
      type?: string;
    };
    currency?: {
      code?: string;
    };
    amount?: number;
    estimatedTimeline?: {
      pickup?: string;
      dropoff?: string;
    };
    distance?: number;
  }>;
};

type GrabCreateResponse = {
  message?: string;
  deliveryID?: string;
  merchantOrderID?: string;
  status?: string;
  trackingURL?: string;
  trackingUrl?: string;
  quote?: {
    amount?: number;
  };
};

function normalizeGrabStatus(value: string): DeliveryWebhookUpdate['status'] {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'QUOTE':
      return 'QUOTE';
    case 'ALLOCATING':
      return 'ALLOCATING';
    case 'QUEUING':
      return 'QUEUING';
    case 'PICKED_UP':
    case 'PICKEDUP':
      return 'PICKED_UP';
    case 'IN_TRANSIT':
    case 'IN_PROGRESS':
    case 'DELIVERING':
    case 'ON_THE_WAY':
      return 'IN_TRANSIT';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'DELIVERED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    case 'FAILED':
    case 'REJECTED':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

function sanitizePhone(value: string): string {
  const digits = value.replace(/[^\d]/g, '');
  return digits || '959000000000';
}

function normalizeCurrency(currency?: string | null): string {
  return currency?.trim().toUpperCase() || 'MMK';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function toCurrency(value: number): number {
  return Number(value.toFixed(2));
}
