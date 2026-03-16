import { NextRequest, NextResponse } from 'next/server';
import { getUberEatsClient } from '@/lib/server/integrations/ubereats/client';
import { saveIntegrationTokens } from '@/lib/server/integration-store';

export const runtime = 'nodejs';

/** 回调后跳转必须使用配置的站点 URL，避免生产环境被 request.url 指到 localhost */
function redirectBase(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env && !env.includes('localhost')) return env.replace(/\/$/, '');
  try {
    const u = new URL(request.url);
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return u.origin;
  } catch {
    // ignore
  }
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://restaurantiq.ai';
}

export async function GET(request: NextRequest) {
  const base = redirectBase(request);
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL(`/settings?error=ubereats_${error}`, base));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?error=ubereats_no_code', base));
    }

    const client = getUberEatsClient();
    const tokens = await client.exchangeCodeForTokens(code);

    await saveIntegrationTokens('ubereats', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
    });

    return NextResponse.redirect(new URL('/settings?success=ubereats_connected', base));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[UberEats Callback] Error:', message, err);
    return NextResponse.redirect(new URL('/settings?error=ubereats_auth_failed', base));
  }
}
