import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { getAppUrlFromRequest } from '@/lib/server/app-url';

const GOOGLE_BUSINESS_OAUTH_STATE_COOKIE = 'google_business_oauth_state';
const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const appUrl = getAppUrlFromRequest(req);
  const redirectUri = `${appUrl}/api/integrations/google-business/callback`;

  if (!clientId) {
    return NextResponse.redirect(
      new URL('/settings?google_business_status=error&google_business_error=missing_client_id', appUrl),
      302
    );
  }

  const nonce = crypto.randomUUID();
  const statePayload = Buffer.from(JSON.stringify({ nonce, ts: Date.now() })).toString('base64url');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_BUSINESS_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', statePayload);

  const res = NextResponse.redirect(url, 302);
  const isSecure = appUrl.startsWith('https');
  res.cookies.set(GOOGLE_BUSINESS_OAUTH_STATE_COOKIE, statePayload, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/api/integrations/google-business/callback',
    maxAge: 60 * 10,
  });
  return res;
}
