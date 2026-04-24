import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import {
  KTPOSDb,
  type OfflineSaleConflictDetails,
  type OfflineSaleErrorKind,
  type OfflineSalePayload,
  type OfflineSaleRecord,
  type OfflineSaleStatus,
} from '$lib/db';
import { buildTenantHeaders } from '$lib/api/tenant';

type WorkerSaleResponse =
  | {
      success?: boolean;
      error?: string;
      data?: unknown;
      snapshot_key?: string;
      recovery_snapshot?: unknown;
    }
  | Record<string, unknown>
  | null;

type SyncAttemptResult =
  | { kind: 'SYNCED'; message: string | null }
  | {
      kind: 'PENDING' | 'CONFLICT';
      message: string;
      errorKind: OfflineSaleErrorKind;
      statusCode: number | null;
      requiresManagerReview: boolean;
      responseBody: Record<string, unknown> | null;
    };

export type SyncSubmissionResult = {
  status: OfflineSaleStatus;
  error: string | null;
  record: OfflineSaleRecord | null;
};

type SyncStateSnapshot = {
  initialized: boolean;
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  conflictCount: number;
  conflicts: OfflineSaleRecord[];
  lastSyncAt: string | null;
  lastError: string | null;
};

const initialState: SyncStateSnapshot = {
  initialized: false,
  online: true,
  syncing: false,
  pendingCount: 0,
  conflictCount: 0,
  conflicts: [],
  lastSyncAt: null,
  lastError: null,
};

export const syncState = writable<SyncStateSnapshot>(initialState);

let initialized = false;
let syncIntervalId: number | null = null;
let activeSyncPromise: Promise<void> | null = null;

export async function initSyncManager(): Promise<void> {
  if (!browser || initialized) {
    return;
  }

  initialized = true;
  syncState.update((state) => ({
    ...state,
    initialized: true,
    online: navigator.onLine,
  }));

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  syncIntervalId = window.setInterval(() => {
    void syncPendingSales();
  }, 30_000);

  await refreshSyncState();
  await syncPendingSales();
}

export async function submitSaleWithOfflineFallback(input: {
  tenantId: string;
  saleNumber: string;
  payload: OfflineSalePayload;
}): Promise<SyncSubmissionResult> {
  if (!browser) {
    return {
      status: 'PENDING',
      error: 'Offline sync is only available in the browser runtime.',
      record: null,
    };
  }

  if (!navigator.onLine) {
    const record = await upsertOfflineSale(input, {
      status: 'PENDING',
      attempted: false,
      conflict: null,
    });

    return {
      status: 'PENDING',
      error: null,
      record,
    };
  }

  const attempt = await sendSaleToWorker(input.tenantId, input.payload);

  if (attempt.kind === 'SYNCED') {
    await markSaleSynced(input.saleNumber);

    return {
      status: 'SYNCED',
      error: null,
      record: null,
    };
  }

  const record = await upsertOfflineSale(input, {
    status: attempt.kind,
    attempted: true,
    conflict: buildConflictDetails(attempt),
  });

  return {
    status: attempt.kind,
    error: attempt.message,
    record,
  };
}

export async function syncPendingSales(): Promise<void> {
  if (!browser) {
    return;
  }

  if (!navigator.onLine) {
    syncState.update((state) => ({
      ...state,
      online: false,
    }));
    return;
  }

  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = performSyncPendingSales();

  try {
    await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

export async function retryOfflineSale(id: number): Promise<void> {
  if (!browser) {
    return;
  }

  const existing = await KTPOSDb.offline_sales.get(id);

  if (!existing?.id) {
    return;
  }

  const now = new Date().toISOString();

  await KTPOSDb.offline_sales.update(existing.id, {
    status: 'PENDING',
    updatedAt: now,
    lastError: null,
    lastHttpStatus: null,
    errorKind: null,
    requiresManagerReview: false,
    conflictDetails: null,
  });

  await refreshSyncState();
  await syncPendingSales();
}

export async function deleteOfflineSale(id: number): Promise<void> {
  if (!browser) {
    return;
  }

  await KTPOSDb.offline_sales.delete(id);
  await refreshSyncState();
}

export function disposeSyncManager(): void {
  if (!browser || !initialized) {
    return;
  }

  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  window.removeEventListener('focus', handleFocus);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  initialized = false;
}

async function performSyncPendingSales(): Promise<void> {
  syncState.update((state) => ({
    ...state,
    syncing: true,
    online: navigator.onLine,
    lastError: null,
  }));

  try {
    const pendingSales = await KTPOSDb.offline_sales.where('status').equals('PENDING').sortBy('queuedAt');

    for (const record of pendingSales) {
      const attempt = await sendSaleToWorker(record.tenantId, record.payload);

      if (attempt.kind === 'SYNCED') {
        await markSaleSynced(record.saleNumber);
        continue;
      }

      await upsertOfflineSale(
        {
          tenantId: record.tenantId,
          saleNumber: record.saleNumber,
          payload: record.payload,
        },
        {
          status: attempt.kind,
          attempted: true,
          conflict: buildConflictDetails(attempt),
        },
      );

      if (shouldPauseSyncLoop(attempt)) {
        syncState.update((state) => ({
          ...state,
          lastError: attempt.message,
        }));
        break;
      }
    }

    syncState.update((state) => ({
      ...state,
      lastSyncAt: new Date().toISOString(),
    }));
  } catch (error) {
    syncState.update((state) => ({
      ...state,
      lastError: error instanceof Error ? error.message : 'Failed to sync offline sales.',
    }));
  } finally {
    syncState.update((state) => ({
      ...state,
      syncing: false,
      online: navigator.onLine,
    }));
    await refreshSyncState();
  }
}

async function sendSaleToWorker(
  tenantId: string,
  payload: OfflineSalePayload,
): Promise<SyncAttemptResult> {
  try {
    const response = await fetch('/api/sale', {
      method: 'POST',
      headers: buildTenantHeaders(tenantId),
      body: JSON.stringify(payload),
    });
    const responseBody = await parseWorkerResponse(response);

    if (response.ok && responseBody?.success !== false) {
      return {
        kind: 'SYNCED',
        message: null,
      };
    }

    return classifySyncFailure(response.status, responseBody);
  } catch (error) {
    return {
      kind: 'PENDING',
      message: error instanceof Error ? error.message : 'Network error while syncing sale.',
      errorKind: 'NETWORK',
      statusCode: null,
      requiresManagerReview: false,
      responseBody: null,
    };
  }
}

function classifySyncFailure(statusCode: number, responseBody: WorkerSaleResponse): SyncAttemptResult {
  const responseRecord = asRecord(responseBody);
  const message = getResponseMessage(responseBody, statusCode);
  const normalized = message.toLowerCase();

  if (statusCode === 401 || statusCode === 403) {
    return {
      kind: 'PENDING',
      message,
      errorKind: 'AUTH',
      statusCode,
      requiresManagerReview: false,
      responseBody: responseRecord,
    };
  }

  if (statusCode >= 500) {
    return {
      kind: 'PENDING',
      message,
      errorKind: 'SERVER',
      statusCode,
      requiresManagerReview: false,
      responseBody: responseRecord,
    };
  }

  if (
    statusCode === 409 ||
    normalized.includes('stock') ||
    normalized.includes('inventory') ||
    normalized.includes('insufficient')
  ) {
    return {
      kind: 'CONFLICT',
      message,
      errorKind: 'STOCK',
      statusCode,
      requiresManagerReview: true,
      responseBody: responseRecord,
    };
  }

  if (
    statusCode === 400 ||
    statusCode === 422 ||
    normalized.includes('required') ||
    normalized.includes('invalid') ||
    normalized.includes('unsupported') ||
    normalized.includes('validation')
  ) {
    return {
      kind: 'CONFLICT',
      message,
      errorKind: 'VALIDATION',
      statusCode,
      requiresManagerReview: true,
      responseBody: responseRecord,
    };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return {
      kind: 'CONFLICT',
      message,
      errorKind: 'UNKNOWN',
      statusCode,
      requiresManagerReview: true,
      responseBody: responseRecord,
    };
  }

  return {
    kind: 'PENDING',
    message,
    errorKind: 'SERVER',
    statusCode,
    requiresManagerReview: false,
    responseBody: responseRecord,
  };
}

function buildConflictDetails(attempt: Exclude<SyncAttemptResult, { kind: 'SYNCED' }>): OfflineSaleConflictDetails {
  return {
    kind: attempt.errorKind,
    message: attempt.message,
    statusCode: attempt.statusCode,
    requiresManagerReview: attempt.requiresManagerReview,
    responseBody: attempt.responseBody,
    detectedAt: new Date().toISOString(),
  };
}

function shouldPauseSyncLoop(attempt: Exclude<SyncAttemptResult, { kind: 'SYNCED' }>): boolean {
  return attempt.kind === 'PENDING';
}

async function upsertOfflineSale(
  input: {
    tenantId: string;
    saleNumber: string;
    payload: OfflineSalePayload;
  },
  options: {
    status: OfflineSaleStatus;
    attempted: boolean;
    conflict: OfflineSaleConflictDetails | null;
  },
): Promise<OfflineSaleRecord> {
  const now = new Date().toISOString();
  const existing = await KTPOSDb.offline_sales.where('saleNumber').equals(input.saleNumber).first();

  if (existing?.id) {
    const retryCount = options.attempted ? existing.retryCount + 1 : existing.retryCount;

    await KTPOSDb.offline_sales.update(existing.id, {
      tenantId: input.tenantId,
      payload: input.payload,
      status: options.status,
      lastError: options.conflict?.message ?? null,
      lastHttpStatus: options.conflict?.statusCode ?? null,
      errorKind: options.conflict?.kind ?? null,
      requiresManagerReview: options.conflict?.requiresManagerReview ?? false,
      conflictDetails: options.status === 'CONFLICT' ? options.conflict : null,
      lastAttemptAt: options.attempted ? now : existing.lastAttemptAt ?? null,
      updatedAt: now,
      retryCount,
      syncedAt: options.status === 'SYNCED' ? now : existing.syncedAt ?? null,
    });

    const updated = await KTPOSDb.offline_sales.get(existing.id);
    await refreshSyncState();

    if (!updated) {
      throw new Error(`Failed to update offline sale ${input.saleNumber}`);
    }

    return updated;
  }

  const id = await KTPOSDb.offline_sales.add({
    queueId: buildQueueId(input.saleNumber),
    saleNumber: input.saleNumber,
    tenantId: input.tenantId,
    payload: input.payload,
    status: options.status,
    lastError: options.conflict?.message ?? null,
    lastHttpStatus: options.conflict?.statusCode ?? null,
    errorKind: options.conflict?.kind ?? null,
    requiresManagerReview: options.conflict?.requiresManagerReview ?? false,
    conflictDetails: options.status === 'CONFLICT' ? options.conflict : null,
    retryCount: options.attempted ? 1 : 0,
    queuedAt: now,
    createdAt: now,
    updatedAt: now,
    lastAttemptAt: options.attempted ? now : null,
    syncedAt: options.status === 'SYNCED' ? now : null,
  });
  const created = await KTPOSDb.offline_sales.get(id);

  await refreshSyncState();

  if (!created) {
    throw new Error(`Failed to create offline sale ${input.saleNumber}`);
  }

  return created;
}

async function markSaleSynced(saleNumber: string): Promise<void> {
  const existing = await KTPOSDb.offline_sales.where('saleNumber').equals(saleNumber).first();

  if (!existing?.id) {
    await refreshSyncState();
    return;
  }

  const now = new Date().toISOString();

  await KTPOSDb.offline_sales.update(existing.id, {
    status: 'SYNCED',
    updatedAt: now,
    syncedAt: now,
    lastAttemptAt: now,
    lastError: null,
    lastHttpStatus: 200,
    errorKind: null,
    requiresManagerReview: false,
    conflictDetails: null,
  });

  await refreshSyncState();
}

async function refreshSyncState(): Promise<void> {
  if (!browser) {
    return;
  }

  const [pendingCount, conflicts] = await Promise.all([
    KTPOSDb.offline_sales.where('status').equals('PENDING').count(),
    KTPOSDb.offline_sales.where('status').equals('CONFLICT').sortBy('updatedAt'),
  ]);

  syncState.update((state) => ({
    ...state,
    online: navigator.onLine,
    pendingCount,
    conflictCount: conflicts.length,
    conflicts: [...conflicts].reverse(),
  }));
}

function handleOnline() {
  syncState.update((state) => ({
    ...state,
    online: true,
  }));
  void syncPendingSales();
}

function handleOffline() {
  syncState.update((state) => ({
    ...state,
    online: false,
  }));
}

function handleFocus() {
  void refreshSyncState();
  void syncPendingSales();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void refreshSyncState();
    void syncPendingSales();
  }
}

function buildQueueId(saleNumber: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `offline-sale-${saleNumber}-${crypto.randomUUID()}`;
  }

  return `offline-sale-${saleNumber}-${Date.now().toString(36)}`;
}

function getResponseMessage(responseBody: WorkerSaleResponse, statusCode: number): string {
  if (responseBody && typeof responseBody === 'object' && 'error' in responseBody) {
    const error = responseBody.error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
  }

  return `Sale sync failed with status ${statusCode}`;
}

function asRecord(value: WorkerSaleResponse): Record<string, unknown> | null {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return null;
}

async function parseWorkerResponse(response: Response): Promise<WorkerSaleResponse> {
  try {
    return (await response.json()) as WorkerSaleResponse;
  } catch {
    return null;
  }
}
