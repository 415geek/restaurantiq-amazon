type GoogleBusinessLocationConnection = {
  name: string;
  title?: string;
  placeId?: string;
  addressLine?: string;
};

type GoogleBusinessAccountConnection = {
  name: string;
  accountName?: string;
  type?: string;
  locations: GoogleBusinessLocationConnection[];
};

type GoogleBusinessConnectionState = {
  updatedAt: number;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  accounts: GoogleBusinessAccountConnection[];
};

const globalStore = globalThis as typeof globalThis & {
  __restaurantIqGoogleBusinessOAuthStore?: Map<string, GoogleBusinessConnectionState>;
};

const store =
  globalStore.__restaurantIqGoogleBusinessOAuthStore ??
  new Map<string, GoogleBusinessConnectionState>();
globalStore.__restaurantIqGoogleBusinessOAuthStore = store;

export function getGoogleBusinessConnectionState(userKey: string) {
  return store.get(userKey);
}

export function upsertGoogleBusinessConnectionState(
  userKey: string,
  next: Partial<GoogleBusinessConnectionState> & { accounts?: GoogleBusinessAccountConnection[] }
) {
  const current = store.get(userKey);
  const merged: GoogleBusinessConnectionState = {
    updatedAt: Date.now(),
    accessToken: next.accessToken ?? current?.accessToken,
    refreshToken: next.refreshToken ?? current?.refreshToken,
    accessTokenExpiresAt: next.accessTokenExpiresAt ?? current?.accessTokenExpiresAt,
    accounts: next.accounts ?? current?.accounts ?? [],
  };
  store.set(userKey, merged);
  return merged;
}

export type { GoogleBusinessAccountConnection, GoogleBusinessConnectionState, GoogleBusinessLocationConnection };
