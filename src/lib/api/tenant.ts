export type TenantLicense = {
  token?: string;
  tenant_id?: string;
  plan_type?: string;
  features?: string[];
  trial_ends_at?: string | null;
  device_fingerprint?: string;
  company_name?: string;
  email?: string;
};

export function readTenantLicense(): TenantLicense | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem('KT POS-license');

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as TenantLicense;
  } catch {
    return null;
  }
}

export function buildTenantHeaders(tenantId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const license = readTenantLicense();

  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  if (license?.token) {
    headers.authorization = `Bearer ${license.token}`;
  }

  if (license?.device_fingerprint) {
    headers['x-device-fingerprint'] = license.device_fingerprint;
  }

  return headers;
}

export function resolveTenantId(fallback?: string): string {
  return readTenantLicense()?.tenant_id ?? fallback ?? '';
}

export async function tenantApiFetch<T>(
  path: string,
  options: {
    tenantId?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: buildTenantHeaders(options.tenantId),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const result = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        error?: string;
        data?: T;
      }
    | null;

  if (!response.ok || !result?.success) {
    throw new Error(result?.error ?? `Request failed with status ${response.status}`);
  }

  return result.data as T;
}
