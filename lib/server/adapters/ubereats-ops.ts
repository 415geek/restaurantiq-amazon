import type { UploadedOpsDocument } from '@/lib/types';
import { getUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import { resolveUberEatsAccessToken } from '@/lib/server/ubereats-token';

type UberEatsOrder = {
  id: string;
  createdAt?: string;
  total?: number;
  gross?: number;
  discount?: number;
  refund?: number;
};

type UberEatsSnapshot = {
  storeIds: string[];
  orderCount: number;
  daysWithData: number;
  actualRevenue: number;
  grossRevenue: number;
  discountTotal: number;
  refundAmount: number;
  startDate?: string;
  endDate?: string;
  warnings: string[];
};

function parseStoreIds(raw?: string) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

function readMoney(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = safeNumber(item[key]);
    if (direct !== null) return direct;
    const nested = item[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const nestedAmount = safeNumber((nested as Record<string, unknown>).amount);
      if (nestedAmount !== null) return nestedAmount;
      const nestedValue = safeNumber((nested as Record<string, unknown>).value);
      if (nestedValue !== null) return nestedValue;
    }
  }
  return 0;
}

function readIsoDate(raw: unknown) {
  if (typeof raw !== 'string') return undefined;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return undefined;
  return new Date(ts).toISOString();
}

function extractOrders(payload: unknown): UberEatsOrder[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const candidates = [
    root.orders,
    root.data,
    (root.data as Record<string, unknown> | undefined)?.orders,
    root.results,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    type ParsedOrder = UberEatsOrder;
    const orders = candidate
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const item = row as Record<string, unknown>;
        const idRaw = item.id ?? item.order_id ?? item.orderId ?? item.uuid;
        const id = typeof idRaw === 'string' ? idRaw : null;
        if (!id) return null;
        return {
          id,
          createdAt: readIsoDate(
            item.created_at ?? item.createdAt ?? item.requested_at ?? item.accepted_at
          ),
          total: readMoney(item, ['total', 'total_amount', 'order_total', 'subtotal']),
          gross: readMoney(item, ['gross', 'gross_amount', 'gross_total', 'basket_total']),
          discount: readMoney(item, ['discount', 'discount_amount', 'promo_amount']),
          refund: readMoney(item, ['refund', 'refund_amount']),
        } as ParsedOrder;
      })
      .filter((row): row is ParsedOrder => row !== null);
    if (orders.length) return orders;
  }
  return [];
}

function buildOrdersEndpoint(
  template: string,
  storeId: string,
  startIso: string,
  endIso: string
) {
  return template
    .replaceAll('{storeId}', encodeURIComponent(storeId))
    .replaceAll('{start}', encodeURIComponent(startIso))
    .replaceAll('{end}', encodeURIComponent(endIso));
}

function hasPlaceholder(template: string, token: string) {
  return template.includes(`{${token}}`);
}

async function loadUberEatsSnapshot(userKey: string): Promise<UberEatsSnapshot | null> {
  const configured = Boolean(
    (process.env.UBEREATS_CLIENT_ID && process.env.UBEREATS_CLIENT_SECRET) ||
      process.env.UBEREATS_BEARER_TOKEN
  );
  if (!configured) return null;

  const token = (await resolveUberEatsAccessToken(userKey)).token;
  if (!token) {
    return {
      storeIds: [],
      orderCount: 0,
      daysWithData: 0,
      actualRevenue: 0,
      grossRevenue: 0,
      discountTotal: 0,
      refundAmount: 0,
      warnings: [
        'Uber Eats integration is configured but no access token is available yet. Complete OAuth connect or provide UBEREATS_BEARER_TOKEN.',
      ],
    };
  }

  const endpointTemplate = process.env.UBEREATS_ORDERS_ENDPOINT_TEMPLATE || '';
  if (!endpointTemplate) {
    return {
      storeIds: [],
      orderCount: 0,
      daysWithData: 0,
      actualRevenue: 0,
      grossRevenue: 0,
      discountTotal: 0,
      refundAmount: 0,
      warnings: [
        'UBEREATS_ORDERS_ENDPOINT_TEMPLATE is not configured. Unable to ingest live Uber Eats order payloads.',
      ],
    };
  }

  const connectedStores = getUberEatsConnectionState(userKey)?.stores?.map((store) => store.id) ?? [];
  const envStores = parseStoreIds(process.env.UBEREATS_STORE_IDS);
  const storeIds = connectedStores.length ? connectedStores : envStores;
  const hasStorePlaceholder = hasPlaceholder(endpointTemplate, 'storeId');

  if (hasStorePlaceholder && !storeIds.length) {
    return {
      storeIds: [],
      orderCount: 0,
      daysWithData: 0,
      actualRevenue: 0,
      grossRevenue: 0,
      discountTotal: 0,
      refundAmount: 0,
      warnings: [
        'UBEREATS_ORDERS_ENDPOINT_TEMPLATE expects {storeId} but no store ID is available.',
      ],
    };
  }

  const end = new Date();
  const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 30);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const endpointTargets = hasStorePlaceholder
    ? storeIds.map((storeId) => ({
        storeId,
        url: buildOrdersEndpoint(endpointTemplate, storeId, startIso, endIso),
      }))
    : [{ storeId: 'global', url: buildOrdersEndpoint(endpointTemplate, 'global', startIso, endIso) }];

  const warnings: string[] = [];
  const allOrders: UberEatsOrder[] = [];
  for (const target of endpointTargets) {
    try {
      const response = await fetch(target.url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
      if (!response.ok) {
        warnings.push(`Uber Eats orders endpoint failed (${response.status}) for ${target.storeId}.`);
        continue;
      }
      const payload = await response.json().catch(() => ({}));
      const orders = extractOrders(payload);
      if (!orders.length) {
        warnings.push(`No parseable orders found in Uber Eats payload for ${target.storeId}.`);
      }
      allOrders.push(...orders);
    } catch (error) {
      warnings.push(
        `Uber Eats fetch error for ${target.storeId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`
      );
    }
  }

  const uniqueDays = new Set(
    allOrders
      .map((order) => order.createdAt?.slice(0, 10))
      .filter((value): value is string => Boolean(value))
  );

  const actualRevenue = Number(
    allOrders.reduce((sum, order) => sum + (order.total ?? 0), 0).toFixed(2)
  );
  const grossRevenue = Number(
    allOrders.reduce((sum, order) => sum + (order.gross ?? order.total ?? 0), 0).toFixed(2)
  );
  const discountTotal = Number(
    allOrders.reduce((sum, order) => sum + (order.discount ?? 0), 0).toFixed(2)
  );
  const refundAmount = Number(
    allOrders.reduce((sum, order) => sum + (order.refund ?? 0), 0).toFixed(2)
  );

  return {
    storeIds,
    orderCount: allOrders.length,
    daysWithData: uniqueDays.size,
    actualRevenue,
    grossRevenue,
    discountTotal,
    refundAmount,
    startDate: startIso.slice(0, 10),
    endDate: endIso.slice(0, 10),
    warnings,
  };
}

export async function buildUberEatsOpsDocument(userKey: string): Promise<{
  document: UploadedOpsDocument | null;
  warning?: string;
}> {
  const snapshot = await loadUberEatsSnapshot(userKey);
  if (!snapshot) return { document: null };

  const warning = snapshot.warnings[0];
  const parsed = snapshot.orderCount > 0 || snapshot.actualRevenue > 0;
  if (!parsed) {
    return { document: null, warning };
  }
  const sourceDate = new Date().toISOString();
  const excerpt = `Uber Eats live snapshot: ${snapshot.orderCount} order(s), $${snapshot.actualRevenue.toFixed(
    2
  )} net revenue in last 30 days.`;

  const document: UploadedOpsDocument = {
    id: `ubereats-${sourceDate}`,
    fileName: `ubereats-live-${sourceDate.slice(0, 10)}.json`,
    mimeType: 'application/json',
    size: 0,
    category: 'delivery',
    parsingStatus: 'parsed',
    source: 'ubereats_api',
    extractedText: excerpt,
    excerpt,
    cleaningActions: [
      'pulled via Uber Eats integration',
      'normalized delivery order payload',
      'mapped into Agent A canonical metrics',
    ],
    structuredPreview: {
      format: 'json',
      sourceType: 'order_details',
      rowCount: snapshot.orderCount,
      columns: ['order_id', 'created_at', 'total', 'gross', 'discount', 'refund'],
      canonicalMetrics: {
        total_orders: snapshot.orderCount,
        actual_revenue: snapshot.actualRevenue,
        gross_revenue: snapshot.grossRevenue,
        discount_total: snapshot.discountTotal,
        refund_amount: snapshot.refundAmount,
      },
      businessMetrics: {
        totalOrders: snapshot.orderCount,
        daysWithData: snapshot.daysWithData,
        actualRevenue: snapshot.actualRevenue,
        grossRevenue: snapshot.grossRevenue,
        discountTotal: snapshot.discountTotal,
        refundAmount: snapshot.refundAmount,
      },
      platformBreakdown: {
        'Uber Eats': {
          orders: snapshot.orderCount,
          revenue: snapshot.actualRevenue,
        },
      },
      dateStats: { uniqueDays: snapshot.daysWithData },
      dateRange:
        snapshot.startDate && snapshot.endDate
          ? { start: snapshot.startDate, end: snapshot.endDate }
          : undefined,
      datasetHints: ['channel_mix', 'delivery_orders'],
      detectedKeywords: ['uber_eats', 'delivery', 'orders'],
      qualityFlags: snapshot.warnings,
      parserConfidence: 0.82,
      inferredTimeGrain: 'daily',
    },
    uploadedAt: sourceDate,
  };

  return { document, warning };
}
