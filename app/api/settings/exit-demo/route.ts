import { NextRequest, NextResponse } from 'next/server';
import { DEMO_COOKIE_NAME } from '@/lib/server/demo-session';

/** POST: 清除 Demo 模式 cookie，使后续订单操作会真实同步到 Uber Eats 等平台 */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true, message: 'Demo mode exited.' });
  res.cookies.set(DEMO_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
