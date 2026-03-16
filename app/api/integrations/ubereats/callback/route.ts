import { NextRequest, NextResponse } from 'next/server';
import { getUberEatsClient } from '@/lib/server/integrations/ubereats/client';
import { saveIntegrationTokens } from '@/lib/server/integration-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?error=ubereats_${error}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?error=ubereats_no_code', request.url)
      );
    }

    const client = getUberEatsClient();
    const tokens = await client.exchangeCodeForTokens(code);

    // 保存 tokens (实际应用中应该加密存储)
    await saveIntegrationTokens('ubereats', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
    });

    return NextResponse.redirect(
      new URL('/settings?success=ubereats_connected', request.url)
    );
  } catch (error) {
    console.error('[UberEats Callback] Error:', error);
    return NextResponse.redirect(
      new URL('/settings?error=ubereats_auth_failed', request.url)
    );
  }
}
