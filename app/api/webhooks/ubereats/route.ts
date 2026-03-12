import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  appendUberEatsWebhookEvent,
  listUberEatsWebhookEvents,
} from '@/lib/server/ubereats-webhook-store';
import { auth } from '@clerk/nextjs/server';
import {
  loadDeliveryManagementState,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';
import {
  parseUberWebhookEventsToOrders,
  type UberWebhookOrder,
} from '@/lib/server/ubereats-order-normalizer';
import type { DeliveryOrderTicket } from '@/lib/delivery-management-types';

function stripShaPrefix(value: string) {
  return value.replace(/^sha256=/i, '').trim();
}

function toBase64Url(value: Buffer) {
  return value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isUberSignatureValid(rawBody: string, signatureHeader: string, signingKey: string) {
  const normalizedHeader = stripShaPrefix(signatureHeader);
  const digest = createHmac('sha256', signingKey).update(rawBody, 'utf8').digest();
  const candidates = new Set([
    digest.toString('hex'),
    toBase64Url(digest),
    digest.toString('base64'),
  ]);
  for (const candidate of candidates) {
    if (safeEqual(normalizedHeader, candidate)) return true;
  }
  return false;
}

function extractStoreId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const direct = record.store_id ?? record.storeId ?? record.restaurant_id ?? record.restaurantId;
  if (typeof direct === 'string') return direct;
  const nested = record.data;
  if (nested && typeof nested === 'object') {
    const data = nested as Record<string, unknown>;
    const nestedId = data.store_id ?? data.storeId ?? data.restaurant_id ?? data.restaurantId;
    return typeof nestedId === 'string' ? nestedId : undefined;
  }
  return undefined;
}

function extractOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const direct = record.id ?? record.order_id ?? record.orderId ?? record.uuid;
  if (typeof direct === 'string') return direct;
  const nested = record.order || record.data;
  if (nested && typeof nested === 'object') {
    const data = nested as Record<string, unknown>;
    const nestedId = data.id ?? data.order_id ?? data.orderId ?? data.uuid;
    return typeof nestedId === 'string' ? nestedId : null;
  }
  return typeof direct === 'string' ? direct : null;
}

function isOrderNotificationEvent(
  topic: string | null | undefined,
  eventType: string | null | undefined
): boolean {
  if (!topic && !eventType) return false;
  const topicLower = topic?.toLowerCase() ?? '';
  const eventTypeLower = eventType?.toLowerCase() ?? '';

  // Uber Eats order notification events
  // According to docs: orders.notification, orders.cancel, orders.failure, orders.scheduled.notification
  return topicLower.includes('order') && (
    topicLower.includes('notification') ||
    topicLower.includes('cancel') ||
    topicLower.includes('failure') ||
    topicLower.includes('scheduled')
  );
}

async function mergeWebhookOrderToState(
  userKey: string,
  webhookOrder: UberWebhookOrder
): Promise<void> {
  const state = await loadDeliveryManagementState(userKey);
  const normalizedOrder: DeliveryOrderTicket = {
    ...webhookOrder,
    platform: 'ubereats',
  };

  // Check if order already exists (by id or channelOrderId)
  const existingById = state.orders.find((o) => o.id === normalizedOrder.id);
  const existingByChannelId = state.orders.find(
    (o) => o.channelOrderId === normalizedOrder.channelOrderId
  );

  // Don't override if order exists and has more recent data from other sources
  // This allows API-sourced orders to take precedence over webhook-sourced ones
  if (existingById && existingByChannelId) {
    return; // Already exists, no update needed
  }

  // Merge order into state
  const nextOrders = state.orders.filter(
    (o) => o.id !== normalizedOrder.id && o.channelOrderId !== normalizedOrder.channelOrderId
  );
  nextOrders.push(normalizedOrder);

  // Update queue counts for all platforms
  const nextPlatforms = state.platforms.map(platform => ({
    ...platform,
    queueSize: nextOrders.filter(o => o.platform === platform.key && o.status !== 'completed' && o.status !== 'cancelled').length,
  }));

  const nextState = {
    ...state,
    orders: nextOrders.sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt)),
    platforms: nextPlatforms,
  };

  await saveDeliveryManagementState(userKey, nextState);
}

export async function GET(req: NextRequest) {
  const count = Number(req.nextUrl.searchParams.get('limit') || '15');
  const events = await listUberEatsWebhookEvents(count);
  return NextResponse.json({
    ok: true,
    count: events.length,
    events,
    configured: Boolean(
      process.env.UBEREATS_WEBHOOK_SIGNING_KEY || process.env.UBEREATS_CLIENT_SECRET
    ),
    endpoint: '/api/webhooks/ubereats',
  });
}

export async function POST(req: NextRequest) {
  const signatureHeader =
    req.headers.get('x-uber-signature') ||
    req.headers.get('x-uber-signature-sha256') ||
    req.headers.get('uber-signature') ||
    '';
  const signingKey =
    process.env.UBEREATS_WEBHOOK_SIGNING_KEY || process.env.UBEREATS_CLIENT_SECRET || '';

  const rawBody = await req.text();
  if (signingKey) {
    if (!signatureHeader) {
      console.error('[Uber Eats Webhook] Missing signature header');
      return NextResponse.json(
        { ok: false, error: 'missing_signature_header' },
        { status: 401 }
      );
    }
    if (!isUberSignatureValid(rawBody, signatureHeader, signingKey)) {
      console.error('[Uber Eats Webhook] Invalid signature');
      return NextResponse.json(
        { ok: false, error: 'invalid_signature' },
        { status: 401 }
      );
    }
  }

  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = { raw: rawBody };
  }

  const topic =
    req.headers.get('x-uber-topic') ||
    req.headers.get('x-uber-event-type') ||
    undefined;
  const eventType =
    (payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>).event_type ??
        (payload as Record<string, unknown>).type
      : undefined) || undefined;
  const eventTypeText = typeof eventType === 'string' ? eventType : undefined;

  // Log webhook receipt for debugging
  console.log('[Uber Eats Webhook] Received event:', {
    topic,
    eventType: eventTypeText,
    orderId: extractOrderId(payload),
    storeId: extractStoreId(payload),
  });

  await appendUberEatsWebhookEvent({
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    topic: typeof topic === 'string' ? topic : undefined,
    eventType: eventTypeText,
    storeId: extractStoreId(payload),
    payload,
  });

  // Process order notifications to create/update orders in state
  if (isOrderNotificationEvent(topic, eventTypeText)) {
    const { userId } = await auth();
    const userKey = userId ?? 'anonymous';

    try {
      const events = await listUberEatsWebhookEvents(1);
      const orders = parseUberWebhookEventsToOrders(events);
      if (orders.length > 0) {
        await mergeWebhookOrderToState(userKey, orders[0]);
        console.log('[Uber Eats Webhook] Order created/updated:', orders[0].id);
      }
    } catch (error) {
      console.error('[Uber Eats Webhook] Failed to merge order:', error);
    }
  }

  return NextResponse.json({
    ok: true,
    received: true,
  });
}
