import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { auth } from '@clerk/nextjs/server';
import { upsertMetaConnectionState } from '@/lib/server/meta-oauth-store';

const META_OAUTH_STATE_COOKIE = 'meta_oauth_state';
const META_CONNECTION_COOKIE = 'meta_connections';

type MetaProvider = 'facebook' | 'instagram';

type MetaConnectionsCookie = {
  facebook?: { connected: boolean; connectedAt: string; pages?: Array<{ id: string; name: string }> };
  instagram?: { connected: boolean; connectedAt: string; accounts?: Array<{ id: string; username?: string; name?: string }> };
};

function parseState(raw: string | null): { provider: MetaProvider; nonce: string; ts: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if ((parsed.provider === 'facebook' || parsed.provider === 'instagram') && typeof parsed.nonce === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function readConnections(req: NextRequest): MetaConnectionsCookie {
  const raw = req.cookies.get(META_CONNECTION_COOKIE)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as MetaConnectionsCookie;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/integrations/meta/callback`;

  const url = new URL(req.url);
  const incomingState = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const expectedState = req.cookies.get(META_OAUTH_STATE_COOKIE)?.value ?? null;
  const parsed = parseState(incomingState);
  const provider = parsed?.provider ?? 'facebook';

  const redirectBack = (params: Record<string, string>) => {
    const out = new URL('/settings', appUrl);
    for (const [k, v] of Object.entries(params)) out.searchParams.set(k, v);
    const res = NextResponse.redirect(out);
    res.cookies.delete(META_OAUTH_STATE_COOKIE);
    return res;
  };

  if (error) {
    return redirectBack({
      meta_provider: provider,
      meta_status: 'error',
      meta_error: error,
      meta_error_description: errorDescription ?? 'Authorization failed',
    });
  }

  if (!appId || !appSecret) {
    return redirectBack({
      meta_provider: provider,
      meta_status: 'error',
      meta_error: 'missing_env',
      meta_error_description: 'META_APP_ID / META_APP_SECRET not configured',
    });
  }

  if (!code || !incomingState || incomingState !== expectedState || !parsed) {
    return redirectBack({
      meta_provider: provider,
      meta_status: 'error',
      meta_error: 'invalid_state_or_code',
      meta_error_description: 'Missing code or OAuth state validation failed',
    });
  }

  try {
    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl, { cache: 'no-store' });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData?.error?.message || `Token exchange failed (${tokenRes.status})`);
    }

    const userAccessToken = tokenData.access_token as string;
    const pagesUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
    pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username,name}');
    pagesUrl.searchParams.set('access_token', userAccessToken);

    const pagesRes = await fetch(pagesUrl, { cache: 'no-store' });
    const pagesData = await pagesRes.json().catch(() => ({}));
    const pages: Array<{ id: string; name: string; accessToken?: string; ig: { id: string; username?: string; name?: string } | null }> = Array.isArray(pagesData?.data)
      ? pagesData.data.map((p: { id?: string; name?: string; instagram_business_account?: { id?: string; username?: string; name?: string } }) => ({
          id: p.id ?? '',
          name: p.name ?? 'Untitled Page',
          accessToken: (p as { access_token?: string }).access_token,
          ig: p.instagram_business_account
            ? {
                id: p.instagram_business_account.id ?? '',
                username: p.instagram_business_account.username,
                name: p.instagram_business_account.name,
              }
            : null,
        }))
      : [];

    upsertMetaConnectionState(userKey, {
      userAccessToken,
      pages: pages
        .filter((p) => p.id && p.accessToken)
        .map((p) => ({
          id: p.id,
          name: p.name,
          accessToken: p.accessToken as string,
          instagramBusinessAccount: p.ig
            ? { id: p.ig.id, username: p.ig.username, name: p.ig.name }
            : null,
        })),
    });

    const existing = readConnections(req);
    const now = new Date().toISOString();
    const nextConnections: MetaConnectionsCookie = { ...existing };

    if (provider === 'facebook') {
      nextConnections.facebook = {
        connected: true,
        connectedAt: now,
        pages: pages.filter((p) => p.id).map((p) => ({ id: p.id, name: p.name })),
      };
    } else {
      nextConnections.instagram = {
        connected: true,
        connectedAt: now,
        accounts: pages
          .map((p) => p.ig)
          .filter((ig): ig is { id: string; username?: string; name?: string } => Boolean(ig?.id))
          .map((ig) => ({ id: ig.id, username: ig.username, name: ig.name })),
      };
    }

    const res = redirectBack({
      meta_provider: provider,
      meta_status: 'connected',
      meta_connected_count:
        provider === 'facebook'
          ? String(nextConnections.facebook?.pages?.length ?? 0)
          : String(nextConnections.instagram?.accounts?.length ?? 0),
    });

    res.cookies.set(META_CONNECTION_COOKIE, JSON.stringify(nextConnections), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err) {
    return redirectBack({
      meta_provider: provider,
      meta_status: 'error',
      meta_error: 'oauth_exchange_failed',
      meta_error_description: err instanceof Error ? err.message : 'Meta OAuth exchange failed',
    });
  }
}
