import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type UberEatsStoreConnection = {
  id: string;
  name?: string;
};

type UberEatsConnectionMode = 'oauth' | 'server_token';

type UberEatsConnectionState = {
  updatedAt: number;
  mode: UberEatsConnectionMode;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  stores: UberEatsStoreConnection[];
  asymmetricKeyId?: string;
};

const globalStore = globalThis as typeof globalThis & {
  __restaurantIqUberEatsOAuthStore?: Map<string, UberEatsConnectionState>;
  __restaurantIqUberEatsOAuthStoreHydrated?: boolean;
};

const store = globalStore.__restaurantIqUberEatsOAuthStore ?? new Map<string, UberEatsConnectionState>();
globalStore.__restaurantIqUberEatsOAuthStore = store;
globalStore.__restaurantIqUberEatsOAuthStoreHydrated ??= false;

const runtimeDir = path.join(process.cwd(), '.runtime', 'ubereats');
const runtimeFile = path.join(runtimeDir, 'oauth-connections.json');

function hydrateStore() {
  if (globalStore.__restaurantIqUberEatsOAuthStoreHydrated) return;
  globalStore.__restaurantIqUberEatsOAuthStoreHydrated = true;
  try {
    if (!existsSync(runtimeFile)) return;
    const raw = readFileSync(runtimeFile, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, UberEatsConnectionState>;
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      store.set(key, {
        updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
        mode: value.mode === 'server_token' ? 'server_token' : 'oauth',
        accessToken: value.accessToken,
        refreshToken: value.refreshToken,
        accessTokenExpiresAt: value.accessTokenExpiresAt,
        stores: Array.isArray(value.stores) ? value.stores : [],
        asymmetricKeyId: value.asymmetricKeyId,
      });
    }
  } catch {
    // Ignore hydration issues and keep in-memory store.
  }
}

function persistStore() {
  try {
    mkdirSync(runtimeDir, { recursive: true });
    const asObject = Object.fromEntries(store.entries());
    writeFileSync(runtimeFile, JSON.stringify(asObject, null, 2), 'utf8');
  } catch {
    // Ignore persistence issues; in-memory fallback still works.
  }
}

export function getUberEatsConnectionState(userKey: string) {
  hydrateStore();
  return store.get(userKey) ?? (userKey !== 'shared' ? store.get('shared') : undefined);
}

export function upsertUberEatsConnectionState(
  userKey: string,
  next: Partial<UberEatsConnectionState> & {
    mode: UberEatsConnectionMode;
    stores?: UberEatsStoreConnection[];
  }
) {
  hydrateStore();
  const current = store.get(userKey);
  const merged: UberEatsConnectionState = {
    updatedAt: Date.now(),
    mode: next.mode ?? current?.mode ?? 'oauth',
    accessToken: next.accessToken ?? current?.accessToken,
    refreshToken: next.refreshToken ?? current?.refreshToken,
    accessTokenExpiresAt: next.accessTokenExpiresAt ?? current?.accessTokenExpiresAt,
    stores: next.stores ?? current?.stores ?? [],
    asymmetricKeyId: next.asymmetricKeyId ?? current?.asymmetricKeyId,
  };
  store.set(userKey, merged);
  if (userKey !== 'shared') {
    store.set('shared', merged);
  }
  persistStore();
  return merged;
}

export function clearUberEatsConnectionState(userKey: string) {
  hydrateStore();
  const removed = store.get(userKey);
  store.delete(userKey);
  if (userKey !== 'shared' && removed?.accessToken) {
    const shared = store.get('shared');
    const sameAsCurrent = shared?.accessToken === removed.accessToken;
    if (sameAsCurrent) store.delete('shared');
  }
  persistStore();
}

export type { UberEatsConnectionMode, UberEatsConnectionState, UberEatsStoreConnection };
