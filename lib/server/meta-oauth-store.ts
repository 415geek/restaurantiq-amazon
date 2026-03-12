type MetaPageConnection = {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessAccount?: {
    id: string;
    username?: string;
    name?: string;
  } | null;
};

type MetaUserConnectionState = {
  updatedAt: number;
  userAccessToken?: string;
  pages: MetaPageConnection[];
};

const globalStore = globalThis as typeof globalThis & {
  __restaurantIqMetaOAuthStore?: Map<string, MetaUserConnectionState>;
};

const store = globalStore.__restaurantIqMetaOAuthStore ?? new Map<string, MetaUserConnectionState>();
globalStore.__restaurantIqMetaOAuthStore = store;

export function getMetaConnectionState(userKey: string) {
  return store.get(userKey);
}

export function upsertMetaConnectionState(
  userKey: string,
  next: Partial<MetaUserConnectionState> & { pages?: MetaPageConnection[] }
) {
  const current = store.get(userKey);
  const merged: MetaUserConnectionState = {
    updatedAt: Date.now(),
    userAccessToken: next.userAccessToken ?? current?.userAccessToken,
    pages: next.pages ?? current?.pages ?? [],
  };
  store.set(userKey, merged);
  return merged;
}

export function clearMetaConnectionState(userKey: string) {
  store.delete(userKey);
}

export type { MetaPageConnection, MetaUserConnectionState };
