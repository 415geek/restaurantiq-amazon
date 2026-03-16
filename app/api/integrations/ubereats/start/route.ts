import { NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { auth } from '@clerk/nextjs/server';
import { upsertUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import {
  buildUberTokenRequestBody,
  UberEatsClientAssertionError,
} from '@/lib/server/ubereats-client-assertion';

const UBEREATS_OAUTH_STATE_COOKIE = 'ubereats_oauth_state';
const UBEREATS_CONNECTION_COOKIE = 'ubereats_connection';

type OAuthStatePayload = {
  nonce: string;
  ts: number;
  nextPath: string;
};

function sanitizeToken(raw?: string | null) {
  if (!raw) return '';
  const token = raw.trim();
  if (!token) return '';
  if (token.toLowerCase() === 'none') return '';
  if (token.includes('<ACCESS_TOKEN>')) return '';
  return token;
}

function parseStoreIds(raw?: string) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => ({ id }));
}

function normalizeNextPath(raw: string | null) {
  if (!raw) return '/delivery';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/delivery';
  return raw;
}

function redirectToNextPath(appUrl: string, nextPath: string, params: Record<string, string>) {
  const out = new URL(nextPath, appUrl);
  for (const [key, value] of Object.entries(params)) out.searchParams.set(key, value);
  return out;
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const nextPath = normalizeNextPath(reqUrl.searchParams.get('next'));
  const forceOAuth = reqUrl.searchParams.get('force_oauth') === '1';
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const clientId = process.env.UBEREATS_CLIENT_ID;
  const serviceToken = sanitizeToken(process.env.UBEREATS_BEARER_TOKEN);
  const useServerTokenFlag = process.env.UBEREATS_USE_SERVER_TOKEN === 'true';
  const uberEnv = (process.env.UBEREATS_ENVIRONMENT || process.env.UBEREATS_ENV || 'sandbox')
    .toLowerCase()
    .trim();
  const tokenUrl =
    process.env.UBEREATS_OAUTH_TOKEN_URL ||
    (uberEnv === 'production'
      ? 'https://auth.uber.com/oauth/v2/token'
      : 'https://sandbox-login.uber.com/oauth/v2/token');
  // 生产环境必须用真实站点 URL，否则 Uber 会回调到 localhost。优先从请求头取（兼容 Nginx 反向代理）
  const envAppUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  let appUrl = envAppUrl || 'http://localhost:3000';
  if (process.env.NODE_ENV === 'production') {
    const headers = req.headers;
    const forwardedProto = headers.get('x-forwarded-proto')?.trim();
    const forwardedHost = headers.get('x-forwarded-host')?.trim() || headers.get('host')?.trim();
    if (forwardedHost && forwardedHost !== 'localhost' && !forwardedHost.startsWith('127.0.0.1')) {
      const proto = forwardedProto === 'http' ? 'http' : 'https';
      appUrl = `${proto}://${forwardedHost}`;
    } else if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
      try {
        const origin = new URL(req.url).origin;
        if (origin && !origin.includes('localhost')) appUrl = origin;
      } catch {
        appUrl = 'https://restaurantiq.ai';
      }
    }
  }
  const secureCookie = process.env.NODE_ENV === 'production';

  const clientCredentialsScope =
    process.env.UBEREATS_CLIENT_CREDENTIALS_SCOPES ||
    process.env.UBEREATS_OAUTH_SCOPES ||
    'eats.store eats.store.read eats.store.orders.read eats.store.status.write';
  const authorizationCodeScope =
    process.env.UBEREATS_AUTHORIZATION_CODE_SCOPES ||
    process.env.UBEREATS_OAUTH_AUTHORIZE_SCOPES ||
    'eats.pos_provisioning eats.store eats.store.read eats.store.orders.read eats.store.status.write';

  const useServerTokenMode = Boolean(useServerTokenFlag || !clientId) && !forceOAuth;
  if (useServerTokenMode) {
    let accessToken = serviceToken;
    let mode: 'server_token' | 'oauth' = 'server_token';

    if (!accessToken) {
      try {
        const body = await buildUberTokenRequestBody({
          grantType: 'client_credentials',
          scope: clientCredentialsScope,
        });
        const tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          cache: 'no-store',
        });
        const tokenData = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || typeof tokenData.access_token !== 'string') {
          throw new Error(
            (tokenData as { error_description?: string; error?: string }).error_description ||
              (tokenData as { error?: string }).error ||
              `Uber Eats client-credentials exchange failed (${tokenRes.status})`
          );
        }
        accessToken = tokenData.access_token as string;
        mode = 'oauth';
      } catch (error) {
        const errorCode =
          error instanceof UberEatsClientAssertionError
            ? error.code
            : 'client_credentials_exchange_failed';
        return NextResponse.redirect(
          redirectToNextPath(appUrl, nextPath, {
            ubereats_status: 'error',
            ubereats_error: errorCode,
          })
        );
      }
    }

    if (!accessToken) {
      return NextResponse.redirect(
        redirectToNextPath(appUrl, nextPath, {
          ubereats_status: 'error',
          ubereats_error: 'missing_server_token',
        })
      );
    }

    const stores = parseStoreIds(process.env.UBEREATS_STORE_IDS);
    upsertUberEatsConnectionState(userKey, {
      mode,
      accessToken,
      stores,
      asymmetricKeyId: process.env.UBEREATS_ASYMMETRIC_KEY_ID,
    });

    const res = NextResponse.redirect(
      redirectToNextPath(appUrl, nextPath, {
        ubereats_status: 'connected',
        ubereats_connected_count: String(stores.length),
      })
    );
    res.cookies.set(
      UBEREATS_CONNECTION_COOKIE,
      JSON.stringify({
        connected: true,
        connectedAt: new Date().toISOString(),
        mode,
        stores,
      }),
      {
        httpOnly: true,
        secure: secureCookie,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      }
    );
    return res;
  }

  if (!clientId) {
    return NextResponse.redirect(
      redirectToNextPath(appUrl, nextPath, {
        ubereats_status: 'error',
        ubereats_error: 'missing_client_id',
      })
    );
  }

  let defaultAuthorizeUrl = 'https://auth.uber.com/oauth/v2/authorize';
  try {
    const tokenOrigin = new URL(tokenUrl).origin;
    defaultAuthorizeUrl = `${tokenOrigin}/oauth/v2/authorize`;
  } catch {
    // Keep production default when token URL is malformed.
  }
  const authorizeUrl = process.env.UBEREATS_OAUTH_AUTHORIZE_URL || defaultAuthorizeUrl;
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/integrations/ubereats/callback`;
  const scope = authorizationCodeScope;

  const nonce = crypto.randomUUID();
  const statePayload = Buffer.from(
    JSON.stringify({
      nonce,
      ts: Date.now(),
      nextPath,
    } satisfies OAuthStatePayload)
  ).toString('base64url');
  const url = new URL(authorizeUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', statePayload);

  const res = NextResponse.redirect(url);
  res.cookies.set(UBEREATS_OAUTH_STATE_COOKIE, statePayload, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/api/integrations/ubereats/callback',
    maxAge: 60 * 10,
  });
  return res;
}
