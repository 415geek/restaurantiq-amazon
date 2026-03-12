import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { DeliveryPlatformKey } from '@/lib/delivery-management-types';
import { listDeliveryOrders } from '@/lib/server/delivery-order-query';

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
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const platform = asPlatform(req.nextUrl.searchParams.get('platform'));
  const dateFrom = asDate(req.nextUrl.searchParams.get('dateFrom'));
  const dateTo = asDate(req.nextUrl.searchParams.get('dateTo'));
  const customer = req.nextUrl.searchParams.get('customer')?.trim() || undefined;
  const q = req.nextUrl.searchParams.get('q')?.trim() || undefined;

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
