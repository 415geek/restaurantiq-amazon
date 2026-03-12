import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { applyDeliveryOrderAction } from '@/lib/server/delivery-order-actions';

export const runtime = 'nodejs';

const bodySchema = z.object({
  status: z.enum(['accepted', 'preparing', 'ready', 'completed', 'cancelled']),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  const decodedOrderId = decodeURIComponent(orderId);
  const payload = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_order_action_payload',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const result = await applyDeliveryOrderAction({
    userKey,
    orderId: decodedOrderId,
    status: parsed.data.status,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.message,
        order: result.order,
      },
      { status: result.statusCode }
    );
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    warning: result.warning,
    order: result.order,
    timestamp: new Date().toISOString(),
  });
}
