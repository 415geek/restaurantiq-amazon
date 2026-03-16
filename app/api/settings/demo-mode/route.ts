import { NextRequest, NextResponse } from 'next/server';
import { getDemoIdFromRequest } from '@/lib/server/demo-session';

/** GET: 当前请求是否处于 Demo 模式（带 riq_demo cookie） */
export async function GET(req: NextRequest) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  return NextResponse.json({ isDemo: Boolean(demoId), demoId: demoId ?? null });
}
