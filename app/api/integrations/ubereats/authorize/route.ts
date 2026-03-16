import { NextRequest, NextResponse } from 'next/server';
import { getUberEatsClient, isUberEatsConfigured } from '@/lib/server/integrations/ubereats/client';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!isUberEatsConfigured()) {
      return NextResponse.json(
        { error: 'UberEats not configured. Set UBEREATS_CLIENT_ID and UBEREATS_CLIENT_SECRET.' },
        { status: 500 }
      );
    }

    const client = getUberEatsClient();
    const state = randomUUID();

    // 在生产环境中，应该将 state 存储到 session 以验证回调
    const authUrl = client.getAuthorizationUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[UberEats Authorize] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate UberEats authorization' },
      { status: 500 }
    );
  }
}

