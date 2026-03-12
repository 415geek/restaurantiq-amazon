import { buildUberTokenRequestBody } from '@/lib/server/ubereats-client-assertion';
import {
  getUberEatsConnectionState,
  upsertUberEatsConnectionState,
} from '@/lib/server/ubereats-oauth-store';

export type UberResolvedTokenSource =
  | 'oauth_connection'
  | 'env_bearer_token'
  | 'client_credentials'
  | 'none';

export type UberResolvedToken = {
  token: string;
  source: UberResolvedTokenSource;
  warning?: string;
};

function sanitizeToken(raw?: string | null) {
  if (!raw) return '';
  const token = raw.trim();
  if (!token) return '';
  if (token.toLowerCase() === 'none') return '';
  if (token.includes('<ACCESS_TOKEN>')) return '';
  return token;
}

function resolveTokenEndpoint() {
  if (process.env.UBEREATS_OAUTH_TOKEN_URL?.trim()) {
    return process.env.UBEREATS_OAUTH_TOKEN_URL.trim();
  }
  const env = (process.env.UBEREATS_ENVIRONMENT || process.env.UBEREATS_ENV || 'sandbox')
    .toLowerCase()
    .trim();
  return env === 'production'
    ? 'https://auth.uber.com/oauth/v2/token'
    : 'https://sandbox-login.uber.com/oauth/v2/token';
}

function resolveClientCredentialsScope() {
  return (
    process.env.UBEREATS_CLIENT_CREDENTIALS_SCOPES ||
    process.env.UBEREATS_OAUTH_SCOPES ||
    'eats.store.read eats.store.orders.read eats.store.status.write'
  );
}

function tokenIsFresh(expiresAt?: number) {
  if (!expiresAt) return true;
  return expiresAt - Date.now() > 60 * 1000;
}

async function exchangeClientCredentialsToken(userKey: string): Promise<UberResolvedToken> {
  const clientId = process.env.UBEREATS_CLIENT_ID?.trim();
  if (!clientId) {
    return {
      token: '',
      source: 'none',
      warning: 'UBEREATS_CLIENT_ID not configured.',
    };
  }

  try {
    const tokenUrl = resolveTokenEndpoint();
    const body = await buildUberTokenRequestBody({
      grantType: 'client_credentials',
      scope: resolveClientCredentialsScope(),
    });
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    const accessToken = sanitizeToken(
      typeof tokenData.access_token === 'string' ? tokenData.access_token : ''
    );
    if (!tokenRes.ok || !accessToken) {
      const details =
        (tokenData as { error_description?: string; error?: string }).error_description ||
        (tokenData as { error?: string }).error ||
        `HTTP ${tokenRes.status}`;
      return {
        token: '',
        source: 'none',
        warning: `Uber token exchange failed (${details}).`,
      };
    }

    const expiresIn =
      typeof tokenData.expires_in === 'number' && Number.isFinite(tokenData.expires_in)
        ? tokenData.expires_in
        : 3600;
    upsertUberEatsConnectionState(userKey, {
      mode: 'server_token',
      accessToken,
      refreshToken: undefined,
      accessTokenExpiresAt: Date.now() + expiresIn * 1000,
      stores: getUberEatsConnectionState(userKey)?.stores || [],
      asymmetricKeyId: process.env.UBEREATS_ASYMMETRIC_KEY_ID,
    });
    return {
      token: accessToken,
      source: 'client_credentials',
    };
  } catch (error) {
    return {
      token: '',
      source: 'none',
      warning: error instanceof Error ? error.message : 'token_exchange_unknown_error',
    };
  }
}

export async function resolveUberEatsAccessToken(userKey: string): Promise<UberResolvedToken> {
  const connection = getUberEatsConnectionState(userKey);
  const oauthToken = sanitizeToken(connection?.accessToken);
  if (oauthToken && tokenIsFresh(connection?.accessTokenExpiresAt)) {
    return { token: oauthToken, source: 'oauth_connection' };
  }

  const envToken = sanitizeToken(process.env.UBEREATS_BEARER_TOKEN);
  if (envToken) {
    return { token: envToken, source: 'env_bearer_token' };
  }

  return exchangeClientCredentialsToken(userKey);
}
