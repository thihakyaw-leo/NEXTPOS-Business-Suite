import { injectable } from 'inversify';
import type {
  DeliveryCreateInput,
  DeliveryCreateResult,
  DeliveryEstimateInput,
  DeliveryEstimateQuote,
  DeliveryWebhookUpdate,
  IDeliveryProvider,
} from '../interfaces.js';

@injectable()
export class MockProvider implements IDeliveryProvider {
  readonly code = 'MOCK' as const;

  async estimate(input: DeliveryEstimateInput): Promise<DeliveryEstimateQuote[]> {
    const distanceKm = resolveDistanceKm(input);
    const quantity = input.packages.reduce((sum, entry) => sum + entry.quantity, 0);
    const fee = toCurrency(1500 + distanceKm * 450 + quantity * 120);
    const pickupAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const dropoffAt = new Date(Date.now() + Math.max(35, distanceKm * 7) * 60 * 1000).toISOString();

    return [
      {
        provider: this.code,
        service_type: 'DEV_SAME_DAY',
        fee,
        currency: normalizeCurrency(input.currency),
        estimated_pickup_at: pickupAt,
        estimated_dropoff_at: dropoffAt,
        distance_m: Math.round(distanceKm * 1000),
        quote_id: `${this.code}-QUOTE-${Date.now()}`,
        message: 'Deterministic development quote',
        meta: {
          adapter: 'mock',
        },
      },
    ];
  }

  async createDelivery(input: DeliveryCreateInput): Promise<DeliveryCreateResult> {
    const normalizedInput: DeliveryEstimateInput = {
      ...input,
      packages: input.packages ?? [],
    };
    const [quote] = await this.estimate(normalizedInput);
    const trackingId = `${this.code}-${Date.now()}`;

    return {
      provider: this.code,
      tracking_id: trackingId,
      status: 'ALLOCATING',
      fee: toCurrency(input.quoted_fee ?? quote.fee),
      cost: toCurrency((input.quoted_fee ?? quote.fee) * 0.82),
      tracking_url: `https://mock-delivery.local/track/${trackingId}`,
      waybill_no: trackingId,
      meta: {
        adapter: 'mock',
        sale_number: input.sale_number ?? null,
      },
    };
  }

  async parseWebhook(_request: Request, payload: unknown): Promise<DeliveryWebhookUpdate | null> {
    const body = asRecord(payload);

    if (!body) {
      return null;
    }

    const rawStatus = readString(body.status) ?? readString(body.delivery_status) ?? 'IN_TRANSIT';
    const trackingId = readString(body.tracking_id) ?? readString(body.delivery_tracking_id);

    if (!trackingId && !readString(body.sale_number)) {
      return null;
    }

    return {
      provider: this.code,
      tracking_id: trackingId,
      sale_number: readString(body.sale_number),
      tenant_id: readString(body.tenant_id),
      status: normalizeStatus(rawStatus),
      fee: readNumber(body.delivery_fee),
      cost: readNumber(body.delivery_cost),
      meta: body,
    };
  }
}

function resolveDistanceKm(input: DeliveryEstimateInput): number {
  if (typeof input.distance_km === 'number' && input.distance_km > 0) {
    return input.distance_km;
  }

  if (
    typeof input.pickup.latitude === 'number' &&
    typeof input.pickup.longitude === 'number' &&
    typeof input.dropoff.latitude === 'number' &&
    typeof input.dropoff.longitude === 'number'
  ) {
    return haversineKm(
      input.pickup.latitude,
      input.pickup.longitude,
      input.dropoff.latitude,
      input.dropoff.longitude,
    );
  }

  return Math.max(2, input.packages.reduce((sum, entry) => sum + entry.quantity, 0) * 1.4);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const originLat = toRad(lat1);
  const destinationLat = toRad(lat2);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLon / 2) ** 2;

  return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))).toFixed(2));
}

function normalizeCurrency(currency?: string | null): string {
  return currency?.trim().toUpperCase() || 'MMK';
}

function normalizeStatus(value: string): DeliveryWebhookUpdate['status'] {
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
