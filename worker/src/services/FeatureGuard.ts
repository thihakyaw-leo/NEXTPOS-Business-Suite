import { inject, injectable } from 'inversify';
import {
  TYPES,
  type IAuthService,
  type IFeatureGuard,
  type TenantJwtPayload,
} from '../interfaces.js';

const PLAN_FEATURES: Record<string, string[]> = {
  pos_only: ['pos.checkout', 'inventory.read', 'sales.read', 'sales.write'],
  enterprise: [
    'pos.checkout',
    'inventory.read',
    'sales.read',
    'sales.write',
    'hr_payroll',
  ],
};

@injectable()
export class FeatureGuard implements IFeatureGuard {
  constructor(@inject(TYPES.IAuthService) private readonly authService: IAuthService) {}

  async getTenantClaims(request: Request, expectedTenantId?: string): Promise<TenantJwtPayload | null> {
    const token = extractBearerToken(request.headers.get('authorization'));
    const deviceFingerprint = request.headers.get('x-device-fingerprint')?.trim();

    if (!token || !deviceFingerprint) {
      return null;
    }

    const claims = await this.authService.verifyTenantToken(token);

    if (!claims) {
      return null;
    }

    const validation = await this.authService.validateTenant({
      token,
      device_fingerprint: deviceFingerprint,
    });

    if (validation.status !== 'active' || !validation.tenant_id) {
      return null;
    }

    if (expectedTenantId && validation.tenant_id !== expectedTenantId) {
      return null;
    }

    return {
      ...claims,
      tenant_id: validation.tenant_id,
      plan_type: validation.plan_type ?? claims.plan_type,
      features: validation.features ?? claims.features,
      device_fingerprint: deviceFingerprint,
    };
  }

  hasFeature(claims: Pick<TenantJwtPayload, 'plan_type' | 'features'>, feature: string): boolean {
    const features = new Set<string>(PLAN_FEATURES[claims.plan_type] ?? []);

    for (const enabledFeature of claims.features) {
      features.add(enabledFeature);
    }

    return features.has(feature);
  }
}

function extractBearerToken(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim() || null;
}
