import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Buffer } from 'node:buffer';
import { upsertUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import {
  buildUberTokenRequestBody,
  UberEatsClientAssertionError,
} from '@/lib/server/ubereats-client-assertion';

const UBEREATS_OAUTH_STATE_COOKIE = 'ubereats_oauth_state';
const UBEREATS_CONNECTION_COOKIE = 'ubereats_connection';

type UberEatsConnectionCookie = {
  connected: boolean;
  connectedAt?: string;
  mode?: 'oauth' | 'server_token';
  stores?: Array<{ id: string; name?: string }>;
};

type OAuthState = {
  nonce: string;
  ts: number;
  nextPath?: string;
};

function parseState(raw: string | null): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<OAuthState>;
    if (typeof parsed.nonce === 'string' && typeof parsed.ts === 'number') {
      const nextPath =
        typeof parsed.nextPath === 'string' &&
        parsed.nextPath.startsWith('/') &&
        !parsed.nextPath.startsWith('//')
          ? parsed.nextPath
          : undefined;
      return { nonce: parsed.nonce, ts: parsed.ts, nextPath };
    }
    return null;
  } catch {
    return null;
  }
}

function parseStoreIds(raw?: string) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => ({ id }));
}

function parseStoresPayload(payload: unknown): Array<{ id: string; name?: string }> {
  if (!payload || typeof payload !== 'object') return [];
  const asRecord = payload as Record<string, unknown>;
  const candidates = [
    asRecord.data,
    asRecord.results,
    asRecord.stores,
    asRecord.storefronts,
    payload,
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    type ParsedStore = { id: string; name?: string };
    const stores = candidate
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const item = row as Record<string, unknown>;
        const idRaw = item.store_id ?? item.storeId ?? item.uuid ?? item.id;
        const id = typeof idRaw === 'string' ? idRaw : null;
        if (!id) return null;
        const nameRaw = item.name ?? item.store_name ?? item.title;
        return { id, name: typeof nameRaw === 'string' ? nameRaw : undefined } as ParsedStore;
      })
      .filter((item): item is ParsedStore => item !== null);
    if (stores.length) return stores;
  }
  return [];
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const clientId = process.env.UBEREATS_CLIENT_ID;
  const uberEnv = (process.env.UBEREATS_ENVIRONMENT || process.env.UBEREATS_ENV || 'sandbox')
    .toLowerCase()
    .trim();
  const tokenUrl =
    process.env.UBEREATS_OAUTH_TOKEN_URL ||
    (uberEnv === 'production'
      ? 'https://auth.uber.com/oauth/v2/token'
      : 'https://sandbox-login.uber.com/oauth/v2/token');
  const storesUrl = process.env.UBEREATS_STORES_ENDPOINT;
  const apiBase = process.env.UBEREATS_API_BASE_URL || 'https://api.uber.com';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const secureCookie = process.env.NODE_ENV === 'production';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/integrations/ubereats/callback`;
  const clientCredentialsScope =
    process.env.UBEREATS_CLIENT_CREDENTIALS_SCOPES ||
    process.env.UBEREATS_OAUTH_SCOPES ||
    'eats.store.read eats.store.orders.read eats.store.status.write';

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const incomingState = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const expectedState = req.cookies.get(UBEREATS_OAUTH_STATE_COOKIE)?.value ?? null;
  const parsed = parseState(incomingState);
  const nextPath = parsed?.nextPath || '/delivery';

  const redirectBack = (params: Record<string, string>) => {
    const out = new URL(nextPath, appUrl);
    for (const [key, value] of Object.entries(params)) out.searchParams.set(key, value);
    const res = NextResponse.redirect(out);
    res.cookies.delete(UBEREATS_OAUTH_STATE_COOKIE);
    return res;
  };

  if (error) {
    return redirectBack({
      ubereats_status: 'error',
      ubereats_error: error,
    });
  }

  if (!clientId) {
    return redirectBack({
      ubereats_status: 'error',
      ubereats_error: 'missing_env',
    });
  }

  if (!code || !incomingState || incomingState !== expectedState || !parsed) {
    return redirectBack({
      ubereats_status: 'error',
      ubereats_error: 'invalid_state_or_code',
    });
  }

  try {
    const body = await buildUberTokenRequestBody({
      grantType: 'authorization_code',
      code,
      redirectUri,
    });
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(
        (tokenData as { error_description?: string; error?: string }).error_description ||
          (tokenData as { error?: string }).error ||
          `Uber Eats token exchange failed (${tokenRes.status})`
      );
    }

    const oauthAccessToken = tokenData.access_token as string;
    const oauthRefreshToken =
      typeof tokenData.refresh_token === 'string' ? (tokenData.refresh_token as string) : undefined;
    const oauthExpiresIn =
      typeof tokenData.expires_in === 'number' ? (tokenData.expires_in as number) : 3600;
    let accessToken = oauthAccessToken;
    let refreshToken = oauthRefreshToken;
    let expiresIn = oauthExpiresIn;
    let mode: 'oauth' | 'server_token' = 'oauth';

    try {
      const serviceBody = await buildUberTokenRequestBody({
        grantType: 'client_credentials',
        scope: clientCredentialsScope,
      });
      const serviceTokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: serviceBody,
        cache: 'no-store',
      });
      const serviceTokenData = await serviceTokenRes.json().catch(() => ({}));
      if (serviceTokenRes.ok && typeof serviceTokenData.access_token === 'string') {
        accessToken = serviceTokenData.access_token as string;
        refreshToken = undefined;
        expiresIn =
          typeof serviceTokenData.expires_in === 'number'
            ? (serviceTokenData.expires_in as number)
            : 3600;
        mode = 'server_token';
      }
    } catch {
      // Keep OAuth access token fallback when client-credentials exchange is unavailable.
    }

    let stores = parseStoreIds(process.env.UBEREATS_STORE_IDS);
    try {
      const endpoint = storesUrl || `${apiBase.replace(/\/$/, '')}/v1/eats/stores`;
      const storesRes = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
      if (storesRes.ok) {
        const payload = await storesRes.json().catch(() => ({}));
        const parsedStores = parseStoresPayload(payload);
        if (parsedStores.length) stores = parsedStores;
      }
    } catch {
      // Store lookup is best-effort; fallback to configured store IDs.
    }

    upsertUberEatsConnectionState(userKey, {
      mode,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: Date.now() + expiresIn * 1000,
      stores,
      asymmetricKeyId: process.env.UBEREATS_ASYMMETRIC_KEY_ID,
    });

    const nextCookie: UberEatsConnectionCookie = {
      connected: true,
      connectedAt: new Date().toISOString(),
      mode,
      stores,
    };

    const res = redirectBack({
      ubereats_status: 'connected',
      ubereats_connected_count: String(stores.length),
    });
    res.cookies.set(UBEREATS_CONNECTION_COOKIE, JSON.stringify(nextCookie), {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (exchangeError) {
    const errorMessage =
      exchangeError instanceof UberEatsClientAssertionError
        ? exchangeError.code
        : exchangeError instanceof Error
          ? exchangeError.message
          : 'Uber Eats OAuth exchange failed';
    return redirectBack({
      ubereats_status: 'error',
      ubereats_error: errorMessage,
    });
  }
}
