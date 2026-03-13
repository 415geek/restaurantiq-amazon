import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { applyDeliveryOrderAction } from '@/lib/server/delivery-order-actions';
import { loadDeliveryManagementState, saveDeliveryManagementState } from '@/lib/server/delivery-management-store';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';

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

  const demoId = getDemoIdFromRequest({ headers: req.headers });
  const isDemo = Boolean(demoId);

  const { userId } = await auth();
  const userKey = isDemo && demoId ? demoUserKey(demoId) : (userId ?? 'anonymous');

  if (isDemo) {
    const state = await loadDeliveryManagementState(userKey);
    const nextOrders = state.orders.map((order) =>
      order.id === decodedOrderId ? { ...order, status: parsed.data.status } : order
    );
    const nextState = await saveDeliveryManagementState(userKey, {
      ...state,
      updatedAt: new Date().toISOString(),
      orders: nextOrders,
    });
    const updated = nextState.orders.find((order) => order.id === decodedOrderId);

    return NextResponse.json({
      ok: true,
      message: 'Demo mode: order status updated locally.',
      warning: 'Demo mode: no real platform update was sent.',
      order: updated,
      timestamp: new Date().toISOString(),
    });
  }

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