import type { NextRequest } from 'next/server';

/**
 * 从请求推导应用根 URL，用于 OAuth 回调等。优先使用 NEXT_PUBLIC_APP_URL；
 * 在服务器部署时若未设置，则根据 x-forwarded-host / host 与 proto 构建，保证与用户访问的域名一致。
 */
export function getAppUrlFromRequest(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto =
    req.headers.get('x-forwarded-proto') ??
    (host?.includes('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return 'http://localhost:3000';
}
