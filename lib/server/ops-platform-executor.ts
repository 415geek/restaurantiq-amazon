import type { DeliveryPlatformKey } from '@/lib/delivery-management-types';
import type { OpsExecutionChange } from '@/lib/ops-copilot-types';
import { getUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import { resolveUberEatsAccessToken } from '@/lib/server/ubereats-token';

export type PlatformExecutionRequest = {
  userKey: string;
  commandId: string;
  platform: DeliveryPlatformKey;
  changes: OpsExecutionChange[];
};

export type PlatformExecutionOutcome = {
  success: boolean;
  retryable: boolean;
  message: string;
  syncedAt: string;
  appliedChanges: OpsExecutionChange[];
  httpStatus?: number;
};

function nowIso() {
  return new Date().toISOString();
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function isDemoUserKey(userKey: string) {
  return userKey.startsWith('demo_');
}

async function resolveUberToken(userKey: string) {
  const resolved = await resolveUberEatsAccessToken(userKey);
  if (resolved.token) return resolved.token;
  return (
    getUberEatsConnectionState(userKey)?.accessToken ||
    process.env.UBEREATS_BEARER_TOKEN ||
    ''
  );
}

function resolveUberMutationEndpoint() {
  return (
    process.env.UBEREATS_MENU_MUTATION_ENDPOINT?.trim() ||
    process.env.UBEREATS_MENU_SYNC_ENDPOINT?.trim() ||
    ''
  );
}

async function executeUberEats(request: PlatformExecutionRequest): Promise<PlatformExecutionOutcome> {
  const accessToken = await resolveUberToken(request.userKey);
  if (!accessToken) {
    return {
      success: false,
      retryable: false,
      message:
        'Uber Eats token is missing. Reconnect integration or provide UBEREATS_BEARER_TOKEN.',
      syncedAt: nowIso(),
      appliedChanges: [],
    };
  }

  const endpoint = resolveUberMutationEndpoint();
  if (!endpoint) {
    return {
      success: false,
      retryable: false,
      message:
        'UBEREATS_MENU_MUTATION_ENDPOINT is not configured. Real menu write-back is unavailable.',
      syncedAt: nowIso(),
      appliedChanges: [],
    };
  }

  const payload = {
    commandId: request.commandId,
    source: 'restaurantiq_ops_copilot',
    platform: request.platform,
    changes: request.changes.map((change) => ({
      itemId: change.itemId,
      itemName: change.itemName,
      store: change.store,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      note: change.note,
    })),
    requestedAt: nowIso(),
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const body = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const reason =
        (typeof body?.message === 'string' && body.message) ||
        (typeof body?.error === 'string' && body.error) ||
        `Uber Eats mutation failed (${response.status})`;
      return {
        success: false,
        retryable: isRetryableStatus(response.status),
        message: reason,
        syncedAt: nowIso(),
        appliedChanges: [],
        httpStatus: response.status,
      };
    }

    return {
      success: true,
      retryable: false,
      message: 'Uber Eats mutation accepted.',
      syncedAt: nowIso(),
      appliedChanges: request.changes,
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      success: false,
      retryable: true,
      message: `Uber Eats mutation request error: ${
        error instanceof Error ? error.message : 'unknown'
      }`,
      syncedAt: nowIso(),
      appliedChanges: [],
    };
  }
}

export async function executePlatformChanges(
  request: PlatformExecutionRequest
): Promise<PlatformExecutionOutcome> {
  if (!request.changes.length) {
    return {
      success: true,
      retryable: false,
      message: 'No changes to sync for this platform.',
      syncedAt: nowIso(),
      appliedChanges: [],
    };
  }

  if (isDemoUserKey(request.userKey)) {
    return {
      success: true,
      retryable: false,
      message: 'Demo mode: simulated platform sync (no real changes were sent).',
      syncedAt: nowIso(),
      appliedChanges: request.changes,
    };
  }

  if (request.platform === 'ubereats') {
    return executeUberEats(request);
  }

  return {
    success: false,
    retryable: false,
    message: `Adapter for ${request.platform} is not implemented yet.`,
    syncedAt: nowIso(),
    appliedChanges: [],
  };
}