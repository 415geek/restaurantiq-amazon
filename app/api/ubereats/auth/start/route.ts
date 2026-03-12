import { NextRequest, NextResponse } from 'next/server';
import { uberEatsOAuthService } from '@/lib/server/ubereats-oauth-service';

export const runtime = 'edge';

/**
 * Uber Eats OAuth 授权开始端点
 * 用户点击"连接Uber Eats"时调用
 */
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId') || undefined;

  // 生成授权URL
  const authUrl = uberEatsOAuthService.generateAuthUrl(storeId);

  // 返回授权URL和store ID（前端用于显示和后续验证）
  return NextResponse.json({
    ok: true,
    authUrl,
    storeId,
    redirectBase: process.env.NEXT_PUBLIC_APP_URL || '',
  });
}
