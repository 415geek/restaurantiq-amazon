import type { DeliveryOrderStatus } from '@/lib/delivery-management-types';
import type { UberEatsWebhookEventRecord } from '@/lib/server/ubereats-webhook-store';

export type UberWebhookOrder = {
  id: string;
  channelOrderId: string;
  customerName: string;
  status: DeliveryOrderStatus;
  placedAt: string;
  amount: number;
  etaMins: number;
  items: string[];
  notes?: string;
  storeId?: string;
  raw: Record<string, unknown>;
  receivedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function safeString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%￥¥,]/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readByPath(record: Record<string, unknown>, path: string) {
  const segments = path.split('.');
  let cursor: unknown = record;
  for (const segment of segments) {
    const current = asRecord(cursor);
    if (!current) return undefined;
    cursor = current[segment];
  }
  return cursor;
}

function pickString(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = safeString(readByPath(record, path));
    if (value) return value;
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = safeNumber(readByPath(record, path));
    if (value !== null) return value;
  }
  return null;
}

function normalizeIso(value: unknown, fallbackIso: string) {
  const text = safeString(value);
  if (!text) return fallbackIso;
  const ts = Date.parse(text);
  if (!Number.isFinite(ts)) return fallbackIso;
  return new Date(ts).toISOString();
}

function statusFromTopic(value: string | null): DeliveryOrderStatus | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('complete') || normalized.includes('deliver')) return 'completed';
  if (normalized.includes('ready') || normalized.includes('pickup')) return 'ready';
  if (normalized.includes('prep') || normalized.includes('cook') || normalized.includes('kitchen')) return 'preparing';
  if (normalized.includes('accept') || normalized.includes('confirm')) return 'accepted';
  if (normalized.includes('created') || normalized.includes('new') || normalized.includes('placed')) return 'new';
  return null;
}

function findOrderRecord(payload: unknown): Record<string, unknown> {
  const root = asRecord(payload) ?? {};
  const directOrder = asRecord(root.order);
  if (directOrder) return directOrder;

  const data = asRecord(root.data);
  if (data) {
    const dataOrder = asRecord(data.order);
    if (dataOrder) return dataOrder;
    const hasOrderIdentity = Boolean(
      pickString(data, ['id', 'order_id', 'orderId', 'uuid', 'display_id', 'order_number'])
    );
    if (hasOrderIdentity) return data;
  }

  return root;
}

function extractItemNames(orderRecord: Record<string, unknown>) {
  const candidates = [
    readByPath(orderRecord, 'items'),
    readByPath(orderRecord, 'order.items'),
    readByPath(orderRecord, 'line_items'),
    readByPath(orderRecord, 'basket.items'),
    readByPath(orderRecord, 'cart.items'),
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const names = candidate
      .map((row) => {
        const record = asRecord(row);
        if (!record) return null;
        return (
          pickString(record, ['name', 'title', 'item_name', 'product_name']) ??
          pickString(record, ['product.name'])
        );
      })
      .filter((value): value is string => Boolean(value));

    if (names.length) return names;
  }

  return [];
}

function eventToOrder(event: UberEatsWebhookEventRecord): UberWebhookOrder | null {
  const orderRecord = findOrderRecord(event.payload);
  const id =
    pickString(orderRecord, ['id', 'order_id', 'orderId', 'uuid', 'order.uuid', 'order.id']) ??
    pickString(asRecord(event.payload) ?? {}, ['id', 'order_id', 'orderId', 'uuid']);
  if (!id) return null;

  const status =
    statusFromTopic(
      pickString(orderRecord, ['status', 'state', 'fulfillment_status']) ??
        event.eventType ??
        event.topic ??
        null
    ) ?? 'new';

  const root = asRecord(event.payload) ?? {};
  const channelOrderId =
    pickString(orderRecord, ['display_id', 'order_number', 'order_id', 'orderId', 'id']) ?? id;

  const customerName =
    pickString(orderRecord, [
      'customer_name',
      'customer.name',
      'consumer.name',
      'delivery.recipient_name',
      'eater.name',
      'eater.first_name',
    ]) ??
    pickString(root, ['customer_name', 'customer.name']) ??
    'Unknown';

  const placedAt = normalizeIso(
    readByPath(orderRecord, 'created_at') ??
      readByPath(orderRecord, 'createdAt') ??
      readByPath(orderRecord, 'placed_at') ??
      readByPath(orderRecord, 'requested_at') ??
      readByPath(orderRecord, 'timestamps.created_at') ??
      root.created_at,
    event.receivedAt
  );

  const amount =
    pickNumber(orderRecord, [
      'total',
      'total_amount',
      'total.value',
      'payment.total.amount',
      'price.total.amount',
      'basket.total.amount',
      'order_total',
      'subtotal',
    ]) ?? pickNumber(root, ['total', 'total_amount']) ?? 0;

  const etaMins = Math.max(
    0,
    Math.round(
      pickNumber(orderRecord, [
        'eta_mins',
        'eta_minutes',
        'estimated_prep_time_minutes',
        'fulfillment.eta_minutes',
      ]) ?? 0
    )
  );

  const items = extractItemNames(orderRecord);
  const notes =
    pickString(orderRecord, ['notes', 'special_instructions', 'delivery_notes', 'customer_note']) ??
    pickString(root, ['notes', 'special_instructions']) ??
    undefined;

  const storeId =
    event.storeId ??
    pickString(orderRecord, ['store_id', 'storeId', 'restaurant_id', 'restaurantId']) ??
    pickString(root, ['store_id', 'storeId', 'restaurant_id', 'restaurantId']) ??
    undefined;

  return {
    id,
    channelOrderId,
    customerName,
    status,
    placedAt,
    amount,
    etaMins,
    items,
    notes,
    storeId,
    raw: orderRecord,
    receivedAt: event.receivedAt,
  };
}

export function parseUberWebhookEventsToOrders(events: UberEatsWebhookEventRecord[]) {
  const byId = new Map<string, UberWebhookOrder>();

  for (const event of events) {
    const parsed = eventToOrder(event);
    if (!parsed) continue;

    const existing = byId.get(parsed.id);
    if (!existing) {
      byId.set(parsed.id, parsed);
      continue;
    }

    const existingTs = Date.parse(existing.receivedAt);
    const parsedTs = Date.parse(parsed.receivedAt);

    if (Number.isFinite(parsedTs) && (!Number.isFinite(existingTs) || parsedTs >= existingTs)) {
      byId.set(parsed.id, {
        ...existing,
        ...parsed,
        items: parsed.items.length ? parsed.items : existing.items,
        notes: parsed.notes ?? existing.notes,
        amount: parsed.amount || existing.amount,
      });
    }
  }

  return [...byId.values()].sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt));
}
