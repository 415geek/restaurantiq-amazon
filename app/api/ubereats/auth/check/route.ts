import { NextRequest, NextResponse } from 'next/server';
import { uberEatsOAuthService } from '@/lib/server/ubereats-oauth-service';

export const runtime = 'edge';

/**
 * 检查Uber Eats OAuth配置状态
 */
export async function GET() {
  const config = uberEatsOAuthService.getConfigStatus();

  return NextResponse.json({
    configured: config.configured,
    issues: config.issues,
    authUrl: config.configured ? process.env.UBEREATS_OAUTH_AUTHORIZE_URL : null,
    redirectUri: config.configured ? process.env.NEXT_PUBLIC_APP_URL + '/api/ubereats/auth/callback' : null,
  });
}
