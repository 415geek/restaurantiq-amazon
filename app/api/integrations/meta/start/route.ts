import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';

type MetaProvider = 'facebook' | 'instagram';

const META_OAUTH_STATE_COOKIE = 'meta_oauth_state';

function getProviderScopes(provider: MetaProvider) {
  if (provider === 'instagram') {
    return [
      'business_management',
      'pages_show_list',
      'pages_read_engagement',
    ];
  }

  return [
    'business_management',
    'pages_show_list',
    'pages_read_engagement',
  ];
}

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider');
  if (provider !== 'facebook' && provider !== 'instagram') {
    return NextResponse.json({ error: 'Invalid provider. Use facebook or instagram.' }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/integrations/meta/callback`;

  if (!appId) {
    return NextResponse.redirect(
      new URL(`/settings?meta_provider=${provider}&meta_status=error&meta_error=missing_app_id`, appUrl)
    );
  }

  const nonce = crypto.randomUUID();
  const statePayload = Buffer.from(JSON.stringify({ provider, nonce, ts: Date.now() })).toString('base64url');

  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', statePayload);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', getProviderScopes(provider).join(','));

  const res = NextResponse.redirect(url);
  res.cookies.set(META_OAUTH_STATE_COOKIE, statePayload, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/integrations/meta/callback',
    maxAge: 60 * 10,
  });
  return res;
}
