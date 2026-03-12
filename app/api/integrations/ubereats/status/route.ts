import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import { resolveUberClientAssertionConfig } from '@/lib/server/ubereats-client-assertion';
import { resolveUberEatsAccessToken } from '@/lib/server/ubereats-token';

const UBEREATS_CONNECTION_COOKIE = 'ubereats_connection';

type UberEatsConnectionCookie = {
  connected: boolean;
  connectedAt?: string;
  mode?: 'oauth' | 'server_token';
  stores?: Array<{ id: string; name?: string }>;
};

function parseStoreIds(raw?: string) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => ({ id }));
}

function hasValidEnvToken() {
  const token = process.env.UBEREATS_BEARER_TOKEN?.trim();
  return Boolean(token && token.toLowerCase() !== 'none' && !token.includes('<ACCESS_TOKEN>'));
}

function readConnectionCookie(req: NextRequest): UberEatsConnectionCookie {
  const raw = req.cookies.get(UBEREATS_CONNECTION_COOKIE)?.value;
  if (!raw) return { connected: false };
  try {
    return JSON.parse(raw) as UberEatsConnectionCookie;
  } catch {
    return { connected: false };
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const storeState = getUberEatsConnectionState(userKey);
  const cookieState = readConnectionCookie(req);
  const assertionConfig = await resolveUberClientAssertionConfig();
  const resolvedToken = await resolveUberEatsAccessToken(userKey);

  const configured = Boolean(
    (process.env.UBEREATS_CLIENT_ID &&
      (process.env.UBEREATS_CLIENT_SECRET || assertionConfig)) ||
      hasValidEnvToken()
  );

  const staticStores = parseStoreIds(process.env.UBEREATS_STORE_IDS);
  const stores = storeState?.stores?.length
    ? storeState.stores
    : cookieState.stores?.length
      ? cookieState.stores
      : staticStores;
  const hasActiveToken = Boolean(resolvedToken.token);
  const connected = hasActiveToken;

  // Build helpful error message if not configured
  let setupGuide: string | undefined;
  if (!configured) {
    setupGuide = 'Uber Eats integration requires developer credentials. Apply at https://developer.uber.com/docs/eats and configure UBEREATS_CLIENT_ID and UBEREATS_CLIENT_SECRET in .env.local';
  } else if (!connected && resolvedToken.warning) {
    setupGuide = resolvedToken.setupGuide;
  }

  return NextResponse.json({
    configured,
    ubereats: {
      connected,
      needsReconnect: Boolean(cookieState.connected && !hasActiveToken),
      connectedAt: cookieState.connectedAt,
      mode:
        storeState?.mode ??
        cookieState.mode ??
        (process.env.UBEREATS_USE_SERVER_TOKEN === 'true' ? 'server_token' : 'oauth'),
      stores,
      asymmetricKeyId: process.env.UBEREATS_ASYMMETRIC_KEY_ID || undefined,
      tokenExpiresAt: storeState?.accessTokenExpiresAt ?? undefined,
      warning: resolvedToken.warning,
      setupGuide,
    },
    timestamp: new Date().toISOString(),
  });
}