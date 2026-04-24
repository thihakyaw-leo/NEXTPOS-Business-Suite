import { browser } from '$app/environment';
import type { ActivationState } from '$lib/types/index';
import { isTauri } from '$lib/platform';
import { hydrateFeatures, resetFeatures } from '$lib/stores/featureStore.js';

const ACTIVATION_STORAGE_KEY = 'KT POS-activation';
const LICENSE_STORAGE_KEY = 'KT POS-license';

type RegisterTenantResult = {
  token: string;
  tenant_id: string;
  plan_type: string;
  features: string[];
  trial_ends_at: string;
};

type RegisterTenantResponse = {
  success?: boolean;
  error?: string;
  data?: RegisterTenantResult;
} | null;

type ValidateTenantResponse = {
  success?: boolean;
  error?: string;
  status?: 'active' | 'expired';
  tenant_id?: string;
  plan_type?: string;
  features?: string[];
  trial_ends_at?: string | null;
  reason?: string;
} | null;

type StoredTenantLicense = {
  token?: string;
  tenant_id?: string;
  plan_type?: string;
  features?: string[];
  trial_ends_at?: string | null;
  device_fingerprint?: string;
  company_name?: string;
  email?: string;
};

const createEmptyActivation = (): ActivationState => ({
  isActivated: false,
  hardwareId: '',
  tenantId: '',
  companyName: '',
  email: '',
  activationKey: '',
  token: '',
  planType: '',
  features: [],
  expiresAt: null,
  lastValidatedAt: null,
});

class AuthStore {
  activation = $state<ActivationState>(createEmptyActivation());
  initialized = $state(false);
  initializing = $state(false);
  validationMessage = $state<string | null>(null);
  initializePromise: Promise<void> | null = null;

  get isActivated(): boolean {
    return this.activation.isActivated;
  }

  get companyName(): string {
    return this.activation.companyName || 'KT POS';
  }

  get username(): string {
    return this.activation.email.split('@')[0] || '';
  }

  get tenantId(): string {
    return this.activation.tenantId;
  }

  get hardwareId(): string {
    return this.activation.hardwareId;
  }

  async initialize(): Promise<void> {
    if (!browser) {
      this.initialized = true;
      return;
    }

    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this.performInitialize().finally(() => {
      this.initializePromise = null;
    });

    return this.initializePromise;
  }

  async registerTenant(input: { companyName: string; email: string }): Promise<void> {
    if (!browser) {
      throw new Error('Tenant activation is only available in the browser runtime.');
    }

    if (!this.activation.hardwareId) {
      await this.loadHardwareId();
    }

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        company_name: input.companyName.trim(),
        email: input.email.trim(),
        device_fingerprint: this.activation.hardwareId,
      }),
    });
    const result = (await response.json().catch(() => null)) as RegisterTenantResponse;

    if (!response.ok || !result?.data) {
      throw new Error(result?.error ?? 'Registration failed.');
    }

    this.activation.companyName = input.companyName.trim();
    this.activation.email = input.email.trim();
    this.activation.tenantId = result.data.tenant_id;
    this.activation.token = result.data.token;
    this.activation.planType = result.data.plan_type;
    this.activation.features = result.data.features;
    this.activation.expiresAt = result.data.trial_ends_at;
    this.activation.isActivated = false;
    this.activation.lastValidatedAt = null;
    this.validationMessage = null;

    this.saveActivation();

    const isValid = await this.validateSession();

    if (!isValid) {
      throw new Error(this.validationMessage ?? 'Tenant activation could not be validated.');
    }
  }

  async activateWithToken(token: string): Promise<void> {
    if (!browser) {
      throw new Error('Tenant activation is only available in the browser runtime.');
    }

    if (!this.activation.hardwareId) {
      await this.loadHardwareId();
    }

    // Temporarily set the token and try to validate it
    const oldToken = this.activation.token;
    this.activation.token = token.trim();

    const isValid = await this.validateSession();

    if (!isValid) {
      this.activation.token = oldToken; // Restore old token if invalid
      throw new Error(this.validationMessage ?? 'The provided activation code is invalid for this device.');
    }

    this.saveActivation();
  }

  async loginTenant(input: { email: string }): Promise<void> {
    if (!browser) {
      throw new Error(
        'Tenant activation is only available in the browser runtime.',
      );
    }

    if (!this.activation.hardwareId) {
      await this.loadHardwareId();
    }

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email.trim(),
        device_fingerprint: this.activation.hardwareId,
      }),
    });
    const result = (await response.json().catch(
      () => null,
    )) as RegisterTenantResponse;

    if (!response.ok || !result?.data) {
      throw new Error(
        result?.error ?? 'Login failed. Check your email or try registering.',
      );
    }

    this.activation.email = input.email.trim();
    this.activation.tenantId = result.data.tenant_id;
    this.activation.token = result.data.token;
    this.activation.planType = result.data.plan_type;
    this.activation.features = result.data.features;
    this.activation.expiresAt = result.data.trial_ends_at;
    this.activation.isActivated = false;
    this.activation.lastValidatedAt = null;
    this.validationMessage = null;

    this.saveActivation();

    const isValid = await this.validateSession();

    if (!isValid) {
      throw new Error(
        this.validationMessage ?? 'Tenant activation could not be validated.',
      );
    }
  }

  async validateSession(): Promise<boolean> {
    if (!browser) {
      return false;
    }

    const token = this.activation.token.trim();
    const deviceFingerprint = this.activation.hardwareId.trim();

    if (!token || !deviceFingerprint) {
      this.markUnauthenticated();
      return false;
    }

    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          token,
          device_fingerprint: deviceFingerprint,
        }),
      });
      const result = (await response.json().catch(() => null)) as ValidateTenantResponse;

      if (!response.ok || !result?.success) {
        this.markUnauthenticated(result?.error ?? 'Tenant validation failed.');
        return false;
      }

      if (result.status !== 'active' || !result.tenant_id) {
        this.markUnauthenticated(toValidationMessage(result.reason));
        return false;
      }

      this.activation.isActivated = true;
      this.activation.tenantId = result.tenant_id;
      this.activation.planType = result.plan_type ?? this.activation.planType ?? 'pos_only';
      this.activation.features = result.features ?? [];
      this.activation.expiresAt = result.trial_ends_at ?? this.activation.expiresAt;
      this.activation.lastValidatedAt = new Date().toISOString();
      this.validationMessage = null;

      hydrateFeatures(this.activation.planType, this.activation.features);
      this.saveActivation();
      return true;
    } catch (error) {
      if (this.canUseCachedActivation()) {
        this.validationMessage = 'Unable to reach the activation service. Using the last validated tenant session.';
        hydrateFeatures(this.activation.planType || 'pos_only', this.activation.features);
        this.saveActivation();
        return true;
      }

      this.activation.isActivated = false;
      resetFeatures();
      this.validationMessage =
        error instanceof Error
          ? `${error.message}. Connect to the network and validate again.`
          : 'Unable to reach the activation service. Connect to the network and validate again.';
      this.saveActivation();
      return false;
    }
  }

  loadActivation(): void {
    if (!browser) {
      return;
    }

    const storedActivation = readJson<Partial<ActivationState>>(ACTIVATION_STORAGE_KEY);
    const storedLicense = readJson<StoredTenantLicense>(LICENSE_STORAGE_KEY);

    this.activation = {
      ...createEmptyActivation(),
      ...storedActivation,
      hardwareId: storedLicense?.device_fingerprint ?? storedActivation?.hardwareId ?? '',
      tenantId: storedLicense?.tenant_id ?? storedActivation?.tenantId ?? '',
      companyName: storedLicense?.company_name ?? storedActivation?.companyName ?? '',
      email: storedLicense?.email ?? storedActivation?.email ?? '',
      token: storedLicense?.token ?? storedActivation?.token ?? '',
      planType: storedLicense?.plan_type ?? storedActivation?.planType ?? '',
      features: Array.isArray(storedActivation?.features)
        ? (Array.isArray(storedLicense?.features) ? storedLicense.features : storedActivation.features)
        : Array.isArray(storedLicense?.features)
          ? storedLicense.features
          : [],
      expiresAt: storedLicense?.trial_ends_at ?? storedActivation?.expiresAt ?? null,
      isActivated: Boolean(storedActivation?.isActivated && (storedActivation?.token ?? storedLicense?.token)),
      lastValidatedAt: storedActivation?.lastValidatedAt ?? null,
    };
  }

  saveActivation(): void {
    if (!browser) {
      return;
    }

    localStorage.setItem(
      ACTIVATION_STORAGE_KEY,
      JSON.stringify({
        ...this.activation,
      }),
    );

    if (!this.activation.token) {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
      return;
    }

    const license: StoredTenantLicense = {
      token: this.activation.token,
      tenant_id: this.activation.tenantId,
      plan_type: this.activation.planType,
      features: this.activation.features,
      trial_ends_at: this.activation.expiresAt,
      device_fingerprint: this.activation.hardwareId,
      company_name: this.activation.companyName,
      email: this.activation.email,
    };

    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license));
  }

  async loadHardwareId(): Promise<void> {
    if (!browser || this.activation.hardwareId) {
      return;
    }

    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        this.activation.hardwareId = await invoke<string>('get_hardware_id');
      } catch {
        this.activation.hardwareId = 'TAURI-UNAVAILABLE';
      }

      return;
    }

    try {
      const source = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        screen.width,
        screen.height,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ].join('|');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
      const bytes = Array.from(new Uint8Array(digest));

      this.activation.hardwareId = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      this.activation.hardwareId = 'WEB-UNAVAILABLE';
    }
  }

  async performInitialize(): Promise<void> {
    this.initializing = true;
    this.validationMessage = null;

    this.loadActivation();
    await this.loadHardwareId();

    if (this.activation.token) {
      await this.validateSession();
    } else {
      this.markUnauthenticated();
    }

    this.initialized = true;
    this.initializing = false;
  }

  canUseCachedActivation(): boolean {
    if (!this.activation.lastValidatedAt || !this.activation.token || !this.activation.expiresAt) {
      return false;
    }

    const expiresAt = Date.parse(this.activation.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  }

  markUnauthenticated(message: string | null = null): void {
    this.activation.isActivated = false;
    this.activation.tenantId = '';
    this.activation.token = '';
    this.activation.planType = '';
    this.activation.features = [];
    this.activation.expiresAt = null;
    this.activation.lastValidatedAt = null;
    this.validationMessage = message;

    resetFeatures();
    this.saveActivation();
  }
}

export const auth = new AuthStore();

function readJson<T>(key: string): T | null {
  if (!browser) {
    return null;
  }

  const raw = localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toValidationMessage(reason?: string): string {
  switch (reason) {
    case 'device_mismatch':
      return 'This license is not valid for this device.';
    case 'tenant_missing':
      return 'The tenant record for this device could not be found.';
    case 'trial_expired':
      return 'This tenant trial has expired.';
    case 'invalid_token':
      return 'This device license is invalid or expired.';
    default:
      return 'Tenant validation failed.';
  }
}
