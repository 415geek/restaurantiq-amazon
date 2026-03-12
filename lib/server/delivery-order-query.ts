import type {
  DeliveryOrderDetailResponse,
  DeliveryOrderQueryResponse,
  DeliveryOrderQueryRow,
  DeliveryOrderStatus,
  DeliveryPlatformKey,
} from '@/lib/delivery-management-types';
import { loadDeliveryManagementState } from '@/lib/server/delivery-management-store';
import { getUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import { listUberEatsWebhookEvents } from '@/lib/server/ubereats-webhook-store';
import { parseUberWebhookEventsToOrders } from '@/lib/server/ubereats-order-normalizer';
import { resolveUberEatsAccessToken } from '@/lib/server/ubereats-token';

type OrderQueryFilters = {
  platform?: DeliveryPlatformKey;
  dateFrom?: string;
  dateTo?: string;
  customer?: string;
  q?: string;
};

type InternalOrderRecord = DeliveryOrderQueryRow & {
  raw: Record<string, unknown>;
};

type QueryResult = {
  orders: InternalOrderRecord[];
  source: DeliveryOrderQueryResponse['source'];
  warning?: string;
};

function parseStoreIds(raw?: string) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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

function safeString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
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
    const direct = safeNumber(readByPath(record, path));
    if (direct !== null) return direct;
  }
  return null;
}

function normalizeStatus(raw: string | null): DeliveryOrderStatus {
  const value = raw?.toLowerCase() ?? '';
  if (value.includes('cancel')) return 'cancelled';
  if (value.includes('complete') || value.includes('deliver')) return 'completed';
  if (value.includes('ready') || value.includes('pickup')) return 'ready';
  if (value.includes('prep') || value.includes('cook') || value.includes('kitchen')) return 'preparing';
  if (value.includes('accept') || value.includes('confirm')) return 'accepted';
  return 'new';
}

function normalizeIso(value: unknown) {
  const text = safeString(value);
  if (!text) return null;
  const ts = Date.parse(text);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

function orderLike(value: unknown) {
  const record = asRecord(value);
  if (!record) return false;
  return Boolean(
    pickString(record, [
      'id',
      'order_id',
      'orderId',
      'uuid',
      'order.uuid',
      'order.id',
    ])
  );
}

function extractOrderArray(payload: unknown): Record<string, unknown>[] {
  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      if (current.some((row) => orderLike(row))) {
        return current.map((row) => asRecord(row)).filter((row): row is Record<string, unknown> => row !== null);
      }
      for (const item of current) queue.push(item);
      continue;
    }
    const record = asRecord(current);
    if (!record) continue;
    for (const value of Object.values(record)) queue.push(value);
  }
  return [];
}

function fillEndpointTemplate(
  template: string,
  values: { storeId: string; start: string; end: string }
) {
  return template
    .replaceAll('{storeId}', encodeURIComponent(values.storeId))
    .replaceAll('{start}', encodeURIComponent(values.start))
    .replaceAll('{end}', encodeURIComponent(values.end));
}

function toLocalOrderRecord(order: {
  id: string;
  channelOrderId: string;
  platform: DeliveryPlatformKey;
  customerName: string;
  status: DeliveryOrderStatus;
  placedAt: string;
  amount: number;
  etaMins: number;
  notes?: string;
}): InternalOrderRecord {
  return {
    id: order.id,
    channelOrderId: order.channelOrderId,
    platform: order.platform,
    customerName: order.customerName,
    status: order.status,
    placedAt: order.placedAt,
    amount: order.amount,
    etaMins: order.etaMins,
    source: 'fallback',
    raw: {
      ...order,
      provider: 'local_state_fallback',
    },
  };
}

function toUberOrderRecord(order: Record<string, unknown>, storeId: string): InternalOrderRecord | null {
  const id =
    pickString(order, ['id', 'order_id', 'orderId', 'uuid', 'order.uuid', 'order.id']) ?? null;
  if (!id) return null;
  const channelOrderId =
    pickString(order, ['display_id', 'order_number', 'order_id', 'orderId', 'id']) ?? id;
  const customerName =
    pickString(order, [
      'customer_name',
      'customer.name',
      'eater.name',
      'eater.first_name',
      'consumer.name',
      'delivery.recipient_name',
    ]) ?? 'Unknown';
  const placedAt =
    normalizeIso(
      readByPath(order, 'created_at')
      ?? readByPath(order, 'createdAt')
      ?? readByPath(order, 'accepted_at')
      ?? readByPath(order, 'requested_at')
      ?? readByPath(order, 'timestamps.created_at')
      ?? new Date().toISOString()
    ) ?? new Date().toISOString();
  const amount =
    pickNumber(order, [
      'total',
      'total_amount',
      'total.value',
      'payment.total.amount',
      'price.total.amount',
      'basket.total.amount',
      'order_total',
      'subtotal',
    ]) ?? 0;
  const etaMins =
    Math.max(
      0,
      Math.round(
        pickNumber(order, [
          'eta_mins',
          'eta_minutes',
          'estimated_prep_time_minutes',
          'fulfillment.eta_minutes',
        ]) ?? 0
      )
    );
  return {
    id,
    channelOrderId,
    platform: 'ubereats',
    customerName,
    status: normalizeStatus(
      pickString(order, ['status', 'state', 'fulfillment_status', 'order.status'])
    ),
    placedAt,
    amount,
    etaMins,
    storeId,
    source: 'api',
    raw: order,
  };
}

async function fetchUberEatsWebhookOrders(limit = 120): Promise<InternalOrderRecord[]> {
  try {
    const events = await listUberEatsWebhookEvents(limit);
    const orders = parseUberWebhookEventsToOrders(events);
    return orders.map((order) => ({
      id: order.id,
      channelOrderId: order.channelOrderId,
      platform: 'ubereats',
      customerName: order.customerName,
      status: order.status,
      placedAt: order.placedAt,
      amount: order.amount,
      etaMins: order.etaMins,
      storeId: order.storeId,
      source: 'api',
      raw: {
        ...order.raw,
        provider: 'ubereats_webhook',
        webhookReceivedAt: order.receivedAt,
        notes: order.notes,
        items: order.items,
      },
    }));
  } catch {
    return [];
  }
}

async function fetchUberEatsOrders(
  userKey: string,
  filters: OrderQueryFilters
): Promise<{ orders: InternalOrderRecord[]; warning?: string }> {
  const connection = getUberEatsConnectionState(userKey);
  const resolvedToken = await resolveUberEatsAccessToken(userKey);
  const token = resolvedToken.token;

  if (!token) {
    const configuredDetails = [];
    if (!process.env.UBEREATS_CLIENT_ID) configuredDetails.push('UBEREATS_CLIENT_ID not set');
    const hasAssertionConfig =
      Boolean(process.env.UBEREATS_ASYMMETRIC_KEY_ID) &&
      Boolean(
        process.env.UBEREATS_PRIVATE_KEY_PEM ||
          process.env.UBEREATS_PRIVATE_KEY_BASE64 ||
          process.env.UBEREATS_PRIVATE_KEY_PATH
      );
    if (!process.env.UBEREATS_CLIENT_SECRET && !hasAssertionConfig) {
      configuredDetails.push(
        'Neither UBEREATS_CLIENT_SECRET nor client_assertion private key config is set'
      );
    }
    if (!process.env.UBEREATS_BEARER_TOKEN) configuredDetails.push('UBEREATS_BEARER_TOKEN not set');
    if (!connection?.accessToken) configuredDetails.push('No OAuth token in connection state');

    const source = connection?.accessToken
      ? 'oauth_expired'
      : process.env.UBEREATS_BEARER_TOKEN
        ? 'none'
        : 'not_configured';

    return {
      orders: [],
      warning: `Uber Eats token missing (${source}). ${
        configuredDetails.length ? `Issues: ${configuredDetails.join(', ')}. ` : ''
      }${resolvedToken.warning ? `Details: ${resolvedToken.warning}. ` : ''}Complete OAuth connect or configure UBEREATS_BEARER_TOKEN.`,
    };
  }

  const template = process.env.UBEREATS_ORDERS_ENDPOINT_TEMPLATE || '';
  if (!template) {
    return {
      orders: [],
      warning:
        'UBEREATS_ORDERS_ENDPOINT_TEMPLATE is missing. Unable to query live order list.',
    };
  }

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString();
  const start = filters.dateFrom
    ? new Date(`${filters.dateFrom}T00:00:00.000Z`).toISOString()
    : defaultStart;
  const end = filters.dateTo
    ? new Date(`${filters.dateTo}T23:59:59.999Z`).toISOString()
    : now.toISOString();

  const connectedStores = getUberEatsConnectionState(userKey)?.stores?.map((store) => store.id) ?? [];
  const envStores = parseStoreIds(process.env.UBEREATS_STORE_IDS);
  const storeIds = connectedStores.length ? connectedStores : envStores;
  const needStoreId = template.includes('{storeId}');
  if (needStoreId && !storeIds.length) {
    return {
      orders: [],
      warning: 'UBEREATS_ORDERS_ENDPOINT_TEMPLATE uses {storeId} but no store IDs are configured.',
    };
  }

  const targets = needStoreId
    ? storeIds.map((storeId) => ({ storeId, url: fillEndpointTemplate(template, { storeId, start, end }) }))
    : [{ storeId: 'global', url: fillEndpointTemplate(template, { storeId: 'global', start, end }) }];

  const warnings: string[] = [];
  const records: InternalOrderRecord[] = [];
  for (const target of targets) {
    try {
      const res = await fetch(target.url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        warnings.push(`Uber Eats orders endpoint failed (${res.status}) for ${target.storeId}.`);
        continue;
      }
      const payload = await res.json().catch(() => ({}));
      const orders = extractOrderArray(payload);
      if (!orders.length) {
        warnings.push(`No parseable orders returned for ${target.storeId}.`);
      }
      for (const row of orders) {
        const normalized = toUberOrderRecord(row, target.storeId);
        if (normalized) records.push(normalized);
      }
    } catch (error) {
      warnings.push(
        `Uber Eats query failed for ${target.storeId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`
      );
    }
  }

  return {
    orders: records,
    warning: warnings.length ? warnings[0] : undefined,
  };
}

function applyFilters(rows: InternalOrderRecord[], filters: OrderQueryFilters) {
  return rows
    .filter((row) => {
      if (filters.platform && row.platform !== filters.platform) return false;
      if (filters.dateFrom && row.placedAt.slice(0, 10) < filters.dateFrom) return false;
      if (filters.dateTo && row.placedAt.slice(0, 10) > filters.dateTo) return false;
      const customerNeedle = filters.customer?.trim().toLowerCase();
      if (customerNeedle && !row.customerName.toLowerCase().includes(customerNeedle)) return false;
      const q = filters.q?.trim().toLowerCase();
      if (!q) return true;
      return (
        row.customerName.toLowerCase().includes(q)
        || row.channelOrderId.toLowerCase().includes(q)
        || row.id.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt));
}

function stripRaw(row: InternalOrderRecord): DeliveryOrderQueryRow {
  return {
    id: row.id,
    channelOrderId: row.channelOrderId,
    platform: row.platform,
    customerName: row.customerName,
    status: row.status,
    placedAt: row.placedAt,
    amount: row.amount,
    etaMins: row.etaMins,
    storeId: row.storeId,
    source: row.source,
  };
}

export async function queryDeliveryOrders(
  userKey: string,
  filters: OrderQueryFilters = {}
): Promise<QueryResult> {
  const baseState = await loadDeliveryManagementState(userKey);
  const fallbackOrders = baseState.orders.map(toLocalOrderRecord);

  const shouldQueryUber = !filters.platform || filters.platform === 'ubereats';
  let liveOrders: InternalOrderRecord[] = [];
  let webhookOrders: InternalOrderRecord[] = [];
  let warning: string | undefined;
  if (shouldQueryUber) {
    const live = await fetchUberEatsOrders(userKey, filters);
    liveOrders = live.orders;
    webhookOrders = await fetchUberEatsWebhookOrders();
    warning = live.warning;
    if (warning && webhookOrders.length && warning.includes('UBEREATS_ORDERS_ENDPOINT_TEMPLATE')) {
      warning = undefined;
    }
  }

  const merged = new Map<string, InternalOrderRecord>();
  for (const order of fallbackOrders) {
    merged.set(`${order.platform}:${order.id}`, order);
  }
  for (const order of webhookOrders) {
    merged.set(`${order.platform}:${order.id}`, order);
  }
  for (const order of liveOrders) {
    merged.set(`${order.platform}:${order.id}`, order);
  }

  const filtered = applyFilters([...merged.values()], filters);
  const hasLive = liveOrders.length > 0 || webhookOrders.length > 0;
  const hasFallback = filtered.some((item) => item.source === 'fallback');
  const source: QueryResult['source'] = hasLive
    ? hasFallback
      ? 'mixed'
      : 'live_api'
    : 'fallback';

  return { orders: filtered, source, warning };
}

export async function listDeliveryOrders(
  userKey: string,
  filters: OrderQueryFilters = {}
): Promise<DeliveryOrderQueryResponse> {
  const result = await queryDeliveryOrders(userKey, filters);
  return {
    orders: result.orders.map(stripRaw),
    total: result.orders.length,
    source: result.source,
    warning: result.warning,
  };
}

export async function getDeliveryOrderDetail(
  userKey: string,
  orderId: string,
  filters: OrderQueryFilters = {}
): Promise<DeliveryOrderDetailResponse | null> {
  const result = await queryDeliveryOrders(userKey, filters);
  const found = result.orders.find(
    (item) => item.id === orderId || item.channelOrderId === orderId
  );
  if (!found) return null;
  const summary = stripRaw(found);
  return {
    order: summary,
    details: found.raw,
    source: found.source,
    fetchedAt: new Date().toISOString(),
    warning: result.warning,
  };
}
