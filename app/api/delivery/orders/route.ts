import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { DeliveryPlatformKey } from '@/lib/delivery-management-types';
import { listDeliveryOrders } from '@/lib/server/delivery-order-query';
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

export async function GET(req: NextRequest) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  const isDemo = Boolean(demoId);

  let userId: string | null = null;
  if (!isDemo) {
    try {
      const authResult = await auth();
      userId = authResult.userId ?? null;
    } catch {
      userId = null;
    }
  }
  const userKey = isDemo && demoId ? demoUserKey(demoId) : (userId ?? 'anonymous');

  const platform = asPlatform(req.nextUrl.searchParams.get('platform'));
  const dateFrom = asDate(req.nextUrl.searchParams.get('dateFrom'));
  const dateTo = asDate(req.nextUrl.searchParams.get('dateTo'));
  const customer = req.nextUrl.searchParams.get('customer')?.trim() || undefined;
  const q = req.nextUrl.searchParams.get('q')?.trim() || undefined;

  if (isDemo) {
    const state = await loadDeliveryManagementState(userKey);
    const filtered = state.orders
      .filter((order) => (platform ? order.platform === platform : true))
      .filter((order) => (customer ? order.customerName.toLowerCase().includes(customer.toLowerCase()) : true))
      .filter((order) => (q ? (order.channelOrderId + order.id + order.items.join(' ')).toLowerCase().includes(q.toLowerCase()) : true));

    return NextResponse.json({
      orders: filtered.map((order) => ({
        id: order.id,
        channelOrderId: order.channelOrderId,
        platform: order.platform,
        customerName: order.customerName,
        status: order.status,
        placedAt: order.placedAt,
        amount: order.amount,
        etaMins: order.etaMins,
        source: 'fallback' as const,
      })),
      total: filtered.length,
      source: 'fallback' as const,
      warning: 'Demo mode: delivery orders are mock data.',
      filters: {
        platform: platform ?? 'all',
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        customer: customer ?? null,
        q: q ?? null,
      },
      timestamp: new Date().toISOString(),
    });
  }

  const response = await listDeliveryOrders(userKey, {
    platform,
    dateFrom,
    dateTo,
    customer,
    q,
  });

  return NextResponse.json({
    ...response,
    filters: {
      platform: platform ?? 'all',
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      customer: customer ?? null,
      q: q ?? null,
    },
    timestamp: new Date().toISOString(),
  });
}