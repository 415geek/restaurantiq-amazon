import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Buffer } from 'node:buffer';
import { upsertGoogleBusinessConnectionState } from '@/lib/server/google-business-oauth-store';

const GOOGLE_BUSINESS_OAUTH_STATE_COOKIE = 'google_business_oauth_state';
const GOOGLE_BUSINESS_CONNECTION_COOKIE = 'google_business_connection';

type GoogleBusinessConnectionsCookie = {
  connected: boolean;
  connectedAt?: string;
  accounts?: Array<{ name: string; accountName?: string; type?: string }>;
  locations?: Array<{ name: string; title?: string; placeId?: string }>;
};

function parseState(raw: string | null): { nonce: string; ts: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed.nonce === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/integrations/google-business/callback`;

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const incomingState = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const expectedState = req.cookies.get(GOOGLE_BUSINESS_OAUTH_STATE_COOKIE)?.value ?? null;
  const parsed = parseState(incomingState);

  const redirectBack = (params: Record<string, string>) => {
    const out = new URL('/settings', appUrl);
    for (const [k, v] of Object.entries(params)) out.searchParams.set(k, v);
    const res = NextResponse.redirect(out);
    res.cookies.delete(GOOGLE_BUSINESS_OAUTH_STATE_COOKIE);
    return res;
  };

  if (error) {
    return redirectBack({
      google_business_status: 'error',
      google_business_error: error,
    });
  }

  if (!clientId || !clientSecret) {
    return redirectBack({
      google_business_status: 'error',
      google_business_error: 'missing_env',
    });
  }

  if (!code || !incomingState || incomingState !== expectedState || !parsed) {
    return redirectBack({
      google_business_status: 'error',
      google_business_error: 'invalid_state_or_code',
    });
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      cache: 'no-store',
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(
        (tokenData as { error_description?: string; error?: string }).error_description ||
          (tokenData as { error?: string }).error ||
          `Token exchange failed (${tokenRes.status})`
      );
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken =
      typeof tokenData.refresh_token === 'string' ? (tokenData.refresh_token as string) : undefined;
    const expiresIn =
      typeof tokenData.expires_in === 'number' ? (tokenData.expires_in as number) : 3600;

    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );
    const accountsData = await accountsRes.json().catch(() => ({}));
    if (!accountsRes.ok) {
      throw new Error(
        (accountsData as { error?: { message?: string } })?.error?.message ||
          `Google Business accounts fetch failed (${accountsRes.status})`
      );
    }

    const accounts = Array.isArray((accountsData as { accounts?: unknown[] }).accounts)
      ? ((accountsData as { accounts: Array<{ name?: string; accountName?: string; type?: string }> }).accounts)
      : [];

    const accountConnections = await Promise.all(
      accounts
        .filter((account) => typeof account.name === 'string')
        .map(async (account) => {
          const locationsUrl = new URL(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`
          );
          locationsUrl.searchParams.set('readMask', 'title,storefrontAddress,metadata');

          const locationsRes = await fetch(locationsUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          });
          const locationsData = await locationsRes.json().catch(() => ({}));

          const locations = locationsRes.ok && Array.isArray((locationsData as { locations?: unknown[] }).locations)
            ? ((locationsData as {
                locations: Array<{
                  name?: string;
                  title?: string;
                  metadata?: { placeId?: string };
                  storefrontAddress?: { addressLines?: string[] };
                }>;
              }).locations)
                .filter((location) => typeof location.name === 'string')
                .map((location) => ({
                  name: location.name as string,
                  title: location.title,
                  placeId: location.metadata?.placeId,
                  addressLine: location.storefrontAddress?.addressLines?.join(', '),
                }))
            : [];

          return {
            name: account.name as string,
            accountName: account.accountName,
            type: account.type,
            locations,
          };
        })
    );

    upsertGoogleBusinessConnectionState(userKey, {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: Date.now() + expiresIn * 1000,
      accounts: accountConnections,
    });

    const locations = accountConnections.flatMap((account) => account.locations);
    const nextConnections: GoogleBusinessConnectionsCookie = {
      connected: true,
      connectedAt: new Date().toISOString(),
      accounts: accountConnections.map((account) => ({
        name: account.name,
        accountName: account.accountName,
        type: account.type,
      })),
      locations: locations.map((location) => ({
        name: location.name,
        title: location.title,
        placeId: location.placeId,
      })),
    };

    const res = redirectBack({
      google_business_status: 'connected',
      google_business_connected_count: String(locations.length),
    });
    res.cookies.set(GOOGLE_BUSINESS_CONNECTION_COOKIE, JSON.stringify(nextConnections), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (error) {
    return redirectBack({
      google_business_status: 'error',
      google_business_error:
        error instanceof Error ? error.message : 'Google Business OAuth exchange failed',
    });
  }
}
