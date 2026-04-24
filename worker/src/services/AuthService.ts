import { inject, injectable } from 'inversify';
import {
  TYPES,
  type ActivationRecord,
  type AdminAuthResult,
  type AdminJwtPayload,
  type IAuthService,
  type ID1Repository,
  type LoginTenantInput,
  type RegisterTenantInput,
  type RegisterTenantResult,
  type TenantJwtPayload,
  type TenantRecord,
  type TenantValidationResult,
  type ValidateTenantInput,
} from '../interfaces.js';
import type { Env } from '../types.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TENANT_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const ADMIN_TOKEN_TTL_SECONDS = 12 * 60 * 60;

@injectable()
export class AuthService implements IAuthService {
  constructor(
    @inject(TYPES.ID1Repository) private readonly d1: ID1Repository,
    @inject(TYPES.Env) private readonly env: Env,
  ) {}

  async registerTenant(input: RegisterTenantInput): Promise<RegisterTenantResult | null> {
    const existingActivation = await this.d1.first<ActivationRecord>(
      `SELECT * FROM activations
       WHERE hardware_id = ? AND isdeleted = 0`,
      [input.device_fingerprint],
    );

    if (existingActivation) {
      // Re-activate: If already registered, find the tenant and issue a new token
      const tenant = await this.d1.first<TenantRecord>(
        `SELECT * FROM tenants WHERE tenant_id = ? AND isdeleted = 0`,
        [existingActivation.tenant_id],
      );

      if (tenant) {
        const features = this.parseFeatures(tenant.enabled_features);
        const reToken = await this.issueJwt<Omit<TenantJwtPayload, 'iat' | 'exp' | 'jti'>>(
          {
            token_type: 'tenant',
            tenant_id: tenant.tenant_id,
            plan_type: tenant.plan_type,
            features,
            device_fingerprint: input.device_fingerprint.trim(),
          },
          TENANT_TOKEN_TTL_SECONDS,
        );

        return {
          token: reToken,
          tenant_id: tenant.tenant_id,
          plan_type: tenant.plan_type,
          features,
          trial_ends_at:
            tenant.trial_ends_at ??
            new Date(Date.now() + TENANT_TOKEN_TTL_SECONDS * 1000).toISOString(),
        };
      }

      return null;
    }

    const now = new Date().toISOString();
    const trialEndsAt = new Date(Date.now() + TENANT_TOKEN_TTL_SECONDS * 1000).toISOString();
    const tenantId = `tenant_${crypto.randomUUID().replace(/-/g, '')}`;
    const companyCode = this.buildCompanyCode(input.company_name);
    const features: string[] = [];

    await this.d1.execute(
      `INSERT INTO tenants
       (tenant_id, company_code, company_name, email, plan_type, enabled_features, trial_ends_at, isdeleted, createdate, updatedate)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        tenantId,
        companyCode,
        input.company_name.trim(),
        input.email.trim().toLowerCase(),
        'pos_only',
        JSON.stringify(features),
        trialEndsAt,
        now,
        now,
      ],
    );

    await this.d1.execute(
      `INSERT INTO activations
       (tenant_id, hardware_id, activation_key, activated_at, expires_at, last_seen_at, isdeleted, createdate, updatedate)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        tenantId,
        input.device_fingerprint.trim(),
        this.buildActivationKey(),
        now,
        trialEndsAt,
        now,
        now,
        now,
      ],
    );

    const tenantToken = await this.issueJwt<Omit<TenantJwtPayload, 'iat' | 'exp' | 'jti'>>(
      {
        token_type: 'tenant',
        tenant_id: tenantId,
        plan_type: 'pos_only',
        features,
        device_fingerprint: input.device_fingerprint.trim(),
      },
      TENANT_TOKEN_TTL_SECONDS,
    );

    return {
      token: tenantToken,
      tenant_id: tenantId,
      plan_type: 'pos_only',
      features,
      trial_ends_at: trialEndsAt,
    };
  }

  async loginTenant(input: LoginTenantInput): Promise<RegisterTenantResult | null> {
    const tenant = await this.d1.first<TenantRecord>(
      `SELECT * FROM tenants WHERE email = ? AND isdeleted = 0`,
      [input.email.trim().toLowerCase()],
    );

    if (!tenant) {
      return null;
    }

    const now = new Date().toISOString();
    const activation = await this.d1.first<ActivationRecord>(
      `SELECT * FROM activations
       WHERE tenant_id = ? AND hardware_id = ? AND isdeleted = 0`,
      [tenant.tenant_id, input.device_fingerprint.trim()],
    );

    if (!activation) {
      const trialEndsAt =
        tenant.trial_ends_at ??
        new Date(Date.now() + TENANT_TOKEN_TTL_SECONDS * 1000).toISOString();

      await this.d1.execute(
        `INSERT INTO activations
         (tenant_id, hardware_id, activation_key, activated_at, expires_at, last_seen_at, isdeleted, createdate, updatedate)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          tenant.tenant_id,
          input.device_fingerprint.trim(),
          this.buildActivationKey(),
          now,
          trialEndsAt,
          now,
          now,
          now,
        ],
      );
    }

    const features = this.parseFeatures(tenant.enabled_features);
    const token = await this.issueJwt<Omit<TenantJwtPayload, 'iat' | 'exp' | 'jti'>>(
      {
        token_type: 'tenant',
        tenant_id: tenant.tenant_id,
        plan_type: tenant.plan_type,
        features,
        device_fingerprint: input.device_fingerprint.trim(),
      },
      TENANT_TOKEN_TTL_SECONDS,
    );

    return {
      token,
      tenant_id: tenant.tenant_id,
      plan_type: tenant.plan_type,
      features,
      trial_ends_at:
        tenant.trial_ends_at ??
        new Date(Date.now() + TENANT_TOKEN_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async validateTenant(input: ValidateTenantInput): Promise<TenantValidationResult> {
    const claims = await this.verifyTenantToken(input.token);

    if (!claims) {
      return {
        status: 'expired',
        reason: 'invalid_token',
      };
    }

    if (claims.device_fingerprint !== input.device_fingerprint.trim()) {
      return {
        status: 'expired',
        reason: 'device_mismatch',
      };
    }

    const statusKey = `tenant:v1:val:${claims.tenant_id}:${input.device_fingerprint.trim()}`;
    const cached = await this.env.KV.get<TenantValidationResult>(statusKey, 'json');

    if (cached && cached.status === 'active') {
      // Background update of last_seen_at in D1 to keep D1 accurate without blocking response
      const now = new Date().toISOString();
      this.d1.execute(
        `UPDATE activations SET last_seen_at = ?, updatedate = ? WHERE tenant_id = ? AND hardware_id = ?`,
        [now, now, claims.tenant_id, input.device_fingerprint.trim()]
      ).catch(e => console.error('Failed to sync last_seen_at to D1', e));

      return cached;
    }

    const tenant = await this.d1.first<TenantRecord>(
      `SELECT tenant_id, plan_type, enabled_features, trial_ends_at
       FROM tenants
       WHERE tenant_id = ? AND isdeleted = 0`,
      [claims.tenant_id],
    );

    if (!tenant) {
      return {
        status: 'expired',
        reason: 'tenant_missing',
      };
    }

    if (tenant.trial_ends_at && new Date(tenant.trial_ends_at).getTime() <= Date.now()) {
      return {
        status: 'expired',
        tenant_id: tenant.tenant_id,
        plan_type: tenant.plan_type,
        features: this.parseFeatures(tenant.enabled_features),
        trial_ends_at: tenant.trial_ends_at,
        reason: 'trial_expired',
      };
    }

    const activation = await this.d1.first<ActivationRecord>(
      `SELECT * FROM activations
       WHERE tenant_id = ? AND hardware_id = ? AND isdeleted = 0`,
      [claims.tenant_id, input.device_fingerprint.trim()],
    );

    if (!activation?.id) {
      return {
        status: 'expired',
        tenant_id: tenant.tenant_id,
        plan_type: tenant.plan_type,
        features: this.parseFeatures(tenant.enabled_features),
        trial_ends_at: tenant.trial_ends_at ?? null,
        reason: 'device_mismatch',
      };
    }

    const now = new Date().toISOString();

    await this.d1.execute(
      `UPDATE activations
       SET last_seen_at = ?, updatedate = ?
       WHERE id = ?`,
      [now, now, activation.id],
    );

    const result: TenantValidationResult = {
      status: 'active',
      tenant_id: tenant.tenant_id,
      plan_type: tenant.plan_type,
      features: this.parseFeatures(tenant.enabled_features),
      trial_ends_at: tenant.trial_ends_at ?? null,
    };

    // Cache the result for 1 hour to reduce D1 load
    await this.env.KV.put(statusKey, JSON.stringify(result), { expirationTtl: 3600 });

    return result;
  }

  async verifyTenantToken(token: string): Promise<TenantJwtPayload | null> {
    const payload = await this.verifyJwt<TenantJwtPayload>(token);

    if (!payload || payload.token_type !== 'tenant' || !payload.tenant_id) {
      return null;
    }

    return payload;
  }

  async authenticateAdmin(
    username: string,
    password: string,
    request: Request,
  ): Promise<AdminAuthResult | null> {
    const validUsername = secureCompare(username, this.env.ADMIN_USERNAME);
    const validPassword = secureCompare(password, this.env.ADMIN_PASSWORD);

    if (!validUsername || !validPassword) {
      return null;
    }

    const token = await this.issueJwt<Omit<AdminJwtPayload, 'iat' | 'exp' | 'jti'>>(
      {
        token_type: 'admin',
        role: 'admin',
      },
      ADMIN_TOKEN_TTL_SECONDS,
    );
    const expiresAt = new Date(Date.now() + ADMIN_TOKEN_TTL_SECONDS * 1000).toISOString();

    return {
      token,
      cookie: this.buildAdminCookie(token, request, expiresAt),
      expires_at: expiresAt,
    };
  }

  async verifyAdminToken(token: string): Promise<AdminJwtPayload | null> {
    const payload = await this.verifyJwt<AdminJwtPayload>(token);

    if (!payload || payload.token_type !== 'admin' || payload.role !== 'admin') {
      return null;
    }

    return payload;
  }

  private async issueJwt<T extends object>(
    payload: T,
    ttlSeconds: number,
  ): Promise<string> {
    this.assertSecret();

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + ttlSeconds;
    const header = { alg: 'HS256', typ: 'JWT' };
    const completePayload = {
      ...payload,
      iat,
      exp,
      jti: crypto.randomUUID(),
    };

    const encodedHeader = encodeBase64Url(JSON.stringify(header));
    const encodedPayload = encodeBase64Url(JSON.stringify(completePayload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await crypto.subtle.sign(
      'HMAC',
      await this.importJwtKey(),
      encoder.encode(signingInput) as any,
    );

    return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
  }

  private async verifyJwt<T extends { exp?: number }>(token: string): Promise<T | null> {
    this.assertSecret();

    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return null;
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const isValid = await crypto.subtle.verify(
      'HMAC',
      await this.importJwtKey(),
      decodeBase64Url(encodedSignature) as any,
      encoder.encode(signingInput) as any,
    );

    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(decoder.decode(decodeBase64Url(encodedPayload) as any)) as T;

    if (typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  }

  private importJwtKey(): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'raw',
      encoder.encode(this.env.JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
  }

  private buildCompanyCode(companyName: string): string {
    const slug = companyName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 8) || 'KTPOS';

    return `${slug}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private buildActivationKey(): string {
    return `ACT-${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
  }

  private buildAdminCookie(token: string, request: Request, expiresAt: string): string {
    const isSecure = new URL(request.url).protocol === 'https:' || this.env.ENVIRONMENT === 'production';

    return [
      `admin_token=${token}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Strict',
      `Expires=${new Date(expiresAt).toUTCString()}`,
      `Max-Age=${ADMIN_TOKEN_TTL_SECONDS}`,
      isSecure ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');
  }

  private parseFeatures(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((feature): feature is string => typeof feature === 'string') : [];
    } catch {
      return [];
    }
  }

  private assertSecret(): void {
    if (!this.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }
  }
}

function encodeBase64Url(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function secureCompare(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}
