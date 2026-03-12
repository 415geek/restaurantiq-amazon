import { NextRequest, NextResponse } from 'next/server';
import { uberEatsOAuthService } from '@/lib/server/ubereats-oauth-service';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'edge';

/**
 * Uber Eats OAuth 回调端点
 * Uber授权后重定向回此端点
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  // 错误处理
  if (error) {
    console.error('[Uber Eats OAuth] Authorization error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/delivery?ubereats_error=${encodeURIComponent(error)}`
    );
  }

  // 缺少授权码
  if (!code) {
    console.error('[Uber Eats OAuth] Missing authorization code');
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/delivery?ubereats_error=no_code`
    );
  }

  // 验证state参数
  let stateData;
  try {
    const decodedState = Buffer.from(state!, 'base64').toString('utf8');
    stateData = JSON.parse(decodedState);

    // 验证timestamp（防止重放攻击）
    const stateAge = Date.now() - (stateData.timestamp || 0);
    if (stateAge > 10 * 60 * 1000) { // 10分钟有效期
      console.error('[Uber Eats OAuth] State expired');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/delivery?ubereats_error=state_expired`
      );
    }

    // 验证redirect URI（CSRF防护）
    if (stateData.redirect !== '/delivery' && !stateData.redirect?.startsWith('/delivery')) {
      console.error('[Uber Eats OAuth] Invalid redirect URI');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/delivery?ubereats_error=invalid_redirect`
      );
    }
  } catch (error) {
    console.error('[Uber Eats OAuth] State validation error:', error);
  }

  // 处理授权码交换
  console.log('[Uber Eats OAuth] Processing authorization code for store:', stateData.storeId);

  const result = await uberEatsOAuthService.handleCallback(code!, state!);

  if (result.success) {
    // 将成功状态保存到现有的OAuth store（需要扩展现有store）
    // 临时保存到环境变量用于演示
    const { userId } = await auth();
    const userKey = userId ?? 'demo';

    // TODO: 将token持久化到数据库
    // 对于MVP，我们可以使用现有的ubereats-oauth-store.ts
    const { upsertUberEatsConnectionState } = await import('@/lib/server/ubereats-oauth-store');
    await upsertUberEatsConnectionState(userKey, {
      mode: 'oauth',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpiresAt: Date.now() + (result.expiresIn || 3600) * 1000, // 默认1小时
      stores: stateData.storeId ? [{ id: stateData.storeId, name: `Store ${stateData.storeId}` }] : [],
    });

    console.log('[Uber Eats OAuth] Authorization successful for store:', stateData.storeId);

    // 重定向回订单中心，带上成功状态
    const redirectUrl = stateData.redirect || '/delivery';
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}?ubereats_status=connected&storeId=${stateData.storeId || ''}`
    );
  }

  // 错误处理
  if (!result.success) {
    console.error('[Uber Eats OAuth] Token exchange failed:', result.error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/delivery?ubereats_error=${encodeURIComponent(result.error || 'unknown')}`
    );
  }
}
