import { inject, injectable } from 'inversify';
import {
  TYPES,
  type DeliveryProviderCode,
  type IDeliveryProvider,
  type IDeliveryProviderFactory,
} from '../interfaces.js';

@injectable()
export class DeliveryProviderFactory implements IDeliveryProviderFactory {
  constructor(
    @inject(TYPES.MockDeliveryProvider) private readonly mockProvider: IDeliveryProvider,
    @inject(TYPES.GrabDeliveryProvider) private readonly grabProvider: IDeliveryProvider,
  ) {}

  getProvider(code: DeliveryProviderCode): IDeliveryProvider {
    switch (normalizeProviderCode(code)) {
      case 'GRAB':
        return this.grabProvider;
      case 'LALAMOVE':
        return this.buildAliasProvider('LALAMOVE', 'LALAMOVE_SIMULATED');
      case 'MANUAL':
        return this.buildAliasProvider('MANUAL', 'MANUAL_DISPATCH');
      case 'MOCK':
      default:
        return this.mockProvider;
    }
  }

  getProviders(codes: DeliveryProviderCode[] = ['MOCK', 'GRAB', 'MANUAL']): IDeliveryProvider[] {
    const seen = new Set<DeliveryProviderCode>();
    const providers: IDeliveryProvider[] = [];

    for (const code of codes) {
      const normalized = normalizeProviderCode(code);

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      providers.push(this.getProvider(normalized));
    }

    return providers;
  }

  private buildAliasProvider(code: Extract<DeliveryProviderCode, 'LALAMOVE' | 'MANUAL'>, serviceType: string): IDeliveryProvider {
    return {
      code,
      estimate: async (input) => {
        const quotes = await this.mockProvider.estimate(input);

        return quotes.map((quote) => ({
          ...quote,
          provider: code,
          service_type: serviceType,
          message: `${code} is currently routed through the development adapter.`,
          meta: {
            ...(quote.meta ?? {}),
            adapter: 'mock-alias',
          },
        }));
      },
      createDelivery: async (input) => {
        const delivery = await this.mockProvider.createDelivery({
          ...input,
          provider: 'MOCK',
        });

        return {
          ...delivery,
          provider: code,
          tracking_id: `${code}-${delivery.tracking_id}`,
          waybill_no: `${code}-${delivery.waybill_no ?? delivery.tracking_id}`,
          meta: {
            ...(delivery.meta ?? {}),
            adapter: 'mock-alias',
          },
        };
      },
      parseWebhook: async (request, payload) => {
        const event = await this.mockProvider.parseWebhook(request, payload);

        if (!event) {
          return null;
        }

        return {
          ...event,
          provider: code,
        };
      },
    };
  }
}

function normalizeProviderCode(code: DeliveryProviderCode): DeliveryProviderCode {
  const normalized = code.trim().toUpperCase();

  if (normalized === 'GRAB' || normalized === 'LALAMOVE' || normalized === 'MANUAL') {
    return normalized;
  }

  return 'MOCK';
}
