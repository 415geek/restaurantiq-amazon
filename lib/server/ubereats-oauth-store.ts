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
globalStore.__restaurantIqUberEatsOAuthStoreHydrated ??= true;

export function getUberEatsConnectionState(userKey: string) {
  return store.get(userKey) ?? (userKey !== 'shared' ? store.get('shared') : undefined);
}

export function upsertUberEatsConnectionState(
  userKey: string,
  next: Partial<UberEatsConnectionState> & {
    mode: UberEatsConnectionMode;
    stores?: UberEatsStoreConnection[];
  }
) {
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
  return merged;
}

export function clearUberEatsConnectionState(userKey: string) {
  const removed = store.get(userKey);
  store.delete(userKey);
  if (userKey !== 'shared' && removed?.accessToken) {
    const shared = store.get('shared');
    const sameAsCurrent = shared?.accessToken === removed.accessToken;
    if (sameAsCurrent) store.delete('shared');
  }
}

export type { UberEatsConnectionMode, UberEatsConnectionState, UberEatsStoreConnection };
