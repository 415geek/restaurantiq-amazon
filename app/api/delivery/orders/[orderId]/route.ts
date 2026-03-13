import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { DeliveryPlatformKey } from '@/lib/delivery-management-types';
import { getDeliveryOrderDetail } from '@/lib/server/delivery-order-query';
import { loadDeliveryManagementState } from '@/lib/server/delivery-management-store';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';

export const runtime = 'nodejs';

function asPlatform(raw: string | null): DeliveryPlatformKey | undefined {
  if (!raw || raw === 'all') return undefined;
  if (
    raw === 'ubereats'
    || raw === 'doordash'
    || raw === 'grubhub'
    || raw === 'fantuan'
    || raw === 'hungrypanda'
  ) {
    return raw;
  }
  return undefined;
}

function asDate(raw: string | null) {
  if (!raw) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  const decodedOrderId = decodeURIComponent(orderId);

  const demoId = getDemoIdFromRequest({ headers: req.headers });
  const isDemo = Boolean(demoId);

  const { userId } = await auth();
  const userKey = isDemo && demoId ? demoUserKey(demoId) : (userId ?? 'anonymous');

  const platform = asPlatform(req.nextUrl.searchParams.get('platform'));
  const dateFrom = asDate(req.nextUrl.searchParams.get('dateFrom'));
  const dateTo = asDate(req.nextUrl.searchParams.get('dateTo'));
  const customer = req.nextUrl.searchParams.get('customer')?.trim() || undefined;
  const q = req.nextUrl.searchParams.get('q')?.trim() || undefined;

  if (isDemo) {
    const state = await loadDeliveryManagementState(userKey);
    const found = state.orders.find((order) => order.id === decodedOrderId);
    if (!found) {
      return NextResponse.json(
        { error: 'order_not_found', orderId: decodedOrderId },
        { status: 404 }
      );
    }

    const detail = {
      order: {
        id: found.id,
        channelOrderId: found.channelOrderId,
        platform: found.platform,
        customerName: found.customerName,
        status: found.status,
        placedAt: found.placedAt,
        amount: found.amount,
        etaMins: found.etaMins,
        source: 'fallback' as const,
      },
      details: {
        items: found.items,
        notes: found.notes,
      },
      source: 'fallback' as const,
      fetchedAt: new Date().toISOString(),
      warning: 'Demo mode: order details are mock data.',
    };

    return NextResponse.json({
      ...detail,
      filters: {
        platform: platform ?? 'all',
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        customer: customer ?? null,
        q: q ?? null,
      },
    });
  }

  const detail = await getDeliveryOrderDetail(userKey, decodedOrderId, {
    platform,
    dateFrom,
    dateTo,
    customer,
    q,
  });

  if (!detail) {
    return NextResponse.json(
      { error: 'order_not_found', orderId: decodedOrderId },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...detail,
    filters: {
      platform: platform ?? 'all',
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      customer: customer ?? null,
      q: q ?? null,
    },
  });
}