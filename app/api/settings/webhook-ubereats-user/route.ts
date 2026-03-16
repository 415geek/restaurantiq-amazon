import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getWebhookUserKey, setWebhookUserKey } from '@/lib/server/ubereats-webhook-store';

/** GET: 返回当前配置的 Webhook 接收账号与当前登录用户 ID（用于 UI 展示与对比） */
export async function GET() {
  const { userId } = await auth();
  const configuredUserKey = await getWebhookUserKey();
  return NextResponse.json({
    currentUserId: userId ?? null,
    configuredUserKey: configuredUserKey ?? null,
    isCurrentUserConfigured: Boolean(userId && configuredUserKey && configuredUserKey === userId),
  });
}

/** POST: 将「当前登录用户」设为 Webhook 订单接收账号（一键完成配置） */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized', message: '请先登录' }, { status: 401 });
  }
  await setWebhookUserKey(userId);
  return NextResponse.json({
    ok: true,
    configuredUserKey: userId,
    message: '当前账号已设为接收 Uber 推送订单，新订单将出现在您的配送/订单列表中。',
  });
}
