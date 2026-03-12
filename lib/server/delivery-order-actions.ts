import type { DeliveryOrderStatus, DeliveryOrderTicket } from '@/lib/delivery-management-types';
import {
  applyOrderStatusTransition,
  loadDeliveryManagementState,
  orderQueueForPlatform,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';
import { getDeliveryOrderDetail } from '@/lib/server/delivery-order-query';
import { getUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import { resolveUberEatsAccessToken, type UberResolvedTokenSource } from '@/lib/server/ubereats-token';

export type DeliveryOrderActionResult = {
  ok: boolean;
  statusCode: number;
  message: string;
  warning?: string;
  order?: DeliveryOrderTicket;
};

type UberOrderActionOutcome = {
  ok: boolean;
  warning?: string;
  httpStatus?: number;
  message?: string;
};

const UPDATABLE_STATUSES: DeliveryOrderStatus[] = [
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function safeString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeItems(details: Record<string, unknown>) {
  const candidates = [
    details.items,
    (asRecord(details.order) ?? {}).items,
    details.line_items,
    (asRecord(details.basket) ?? {}).items,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const names = candidate
      .map((row) => {
        const record = asRecord(row);
        if (!record) return null;
        return safeString(record.name ?? record.title ?? record.item_name ?? record.product_name);
      })
      .filter((name): name is string => Boolean(name));
    if (names.length) return names;
  }

  return [];
}

function toTicketFromDetail(detail: NonNullable<Awaited<ReturnType<typeof getDeliveryOrderDetail>>>): DeliveryOrderTicket {
  const details = asRecord(detail.details) ?? {};
  const notes = safeString(
    details.notes ?? details.special_instructions ?? details.customer_note
  ) ?? undefined;
  return {
    id: detail.order.id,
    channelOrderId: detail.order.channelOrderId,
    platform: detail.order.platform,
    customerName: detail.order.customerName,
    items: normalizeItems(details),
    amount: detail.order.amount,
    status: detail.order.status,
    placedAt: detail.order.placedAt,
    etaMins: detail.order.etaMins,
    notes,
  };
}

function statusToUberAction(status: DeliveryOrderStatus) {
  switch (status) {
    case 'accepted':
      return 'accept';
    case 'preparing':
      return 'start_preparing';
    case 'ready':
      return 'ready_for_pickup';
    case 'completed':
      return 'complete';
    case 'cancelled':
      return 'cancel';
    default:
      return status;
  }
}

async function resolveUberToken(
  userKey: string
): Promise<{ token: string; source: UberResolvedTokenSource; debugInfo: Record<string, string> }> {
  const connection = getUberEatsConnectionState(userKey);
  const debugInfo: Record<string, string> = {};

  // Priority 1: OAuth token from connection state
  if (connection?.accessToken) {
    debugInfo.source = 'oauth_connection';
    debugInfo.userKey = userKey;
    return {
      token: connection.accessToken,
      source: 'oauth_connection',
      debugInfo,
    };
  }

  const resolved = await resolveUberEatsAccessToken(userKey);
  if (resolved.token) {
    debugInfo.source = resolved.source;
    return {
      token: resolved.token,
      source: resolved.source,
      debugInfo,
    };
  }

  // No token available
  debugInfo.source = 'none';
  debugInfo.client_id = process.env.UBEREATS_CLIENT_ID ? 'configured' : 'not_configured';
  debugInfo.client_secret = process.env.UBEREATS_CLIENT_SECRET ? 'configured' : 'not_configured';

  return {
    token: '',
    source: 'none',
    debugInfo,
  };
}

function resolveStoreId(order: DeliveryOrderTicket, details?: Record<string, unknown>) {
  if (details) {
    const root = details;
    const nestedOrder = asRecord(root.order) ?? {};
    const candidate =
      safeString(root.store_id ?? root.storeId ?? root.restaurant_id ?? root.restaurantId) ||
      safeString(
        nestedOrder.store_id ??
          nestedOrder.storeId ??
          nestedOrder.restaurant_id ??
          nestedOrder.restaurantId
      );
    if (candidate) return candidate;
  }
  return undefined;
}

function fillEndpointTemplate(
  template: string,
  values: {
    orderId: string;
    channelOrderId: string;
    status: DeliveryOrderStatus;
    action: string;
    storeId?: string;
  }
) {
  return template
    .replaceAll('{orderId}', encodeURIComponent(values.orderId))
    .replaceAll('{channelOrderId}', encodeURIComponent(values.channelOrderId))
    .replaceAll('{status}', encodeURIComponent(values.status))
    .replaceAll('{action}', encodeURIComponent(values.action))
    .replaceAll('{storeId}', encodeURIComponent(values.storeId || ''));
}

async function applyUberOrderAction(options: {
  userKey: string;
  order: DeliveryOrderTicket;
  status: DeliveryOrderStatus;
  details?: Record<string, unknown>;
}): Promise<UberOrderActionOutcome> {
  const { token, source, debugInfo } = await resolveUberToken(options.userKey);
  if (!token) {
    const configuredDetails = Object.entries(debugInfo)
      .filter(([_, value]) => value !== 'configured')
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return {
      ok: false,
      warning: `Uber Eats token missing (${source}). ${configuredDetails ? `Missing: ${configuredDetails}. ` : ''}Reconnect integration or configure UBEREATS_BEARER_TOKEN.`,
    };
  }

  const template =
    process.env.UBEREATS_ORDER_ACTION_ENDPOINT_TEMPLATE?.trim() ||
    process.env.UBEREATS_ORDER_STATUS_ENDPOINT_TEMPLATE?.trim() ||
    '';
  if (!template) {
    return {
      ok: false,
      warning:
        'UBEREATS_ORDER_ACTION_ENDPOINT_TEMPLATE is missing. Action was saved locally only.',
    };
  }

  const action = statusToUberAction(options.status);
  const storeId = resolveStoreId(options.order, options.details);
  const endpoint = fillEndpointTemplate(template, {
    orderId: options.order.id,
    channelOrderId: options.order.channelOrderId,
    status: options.status,
    action,
    storeId,
  });

  const method = (process.env.UBEREATS_ORDER_ACTION_METHOD || 'POST').toUpperCase();
  const payload = {
    orderId: options.order.id,
    channelOrderId: options.order.channelOrderId,
    status: options.status,
    action,
    storeId,
    requestedAt: new Date().toISOString(),
    source: 'restaurantiq_delivery_console',
  };

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : JSON.stringify(payload),
      cache: 'no-store',
    });

    const body = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const reason =
        safeString(body.message) ||
        safeString(body.error) ||
        `Uber Eats action request failed (${response.status}).`;
      return {
        ok: false,
        httpStatus: response.status,
        message: reason,
      };
    }

    return {
      ok: true,
      httpStatus: response.status,
      message: 'Uber Eats action accepted.',
    };
  } catch (error) {
    return {
      ok: false,
      message: `Uber Eats action request error: ${
        error instanceof Error ? error.message : 'unknown'
      }`,
    };
  }
}

export async function applyDeliveryOrderAction(options: {
  userKey: string;
  orderId: string;
  status: DeliveryOrderStatus;
}): Promise<DeliveryOrderActionResult> {
  if (!UPDATABLE_STATUSES.includes(options.status)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'unsupported_status_transition',
    };
  }

  const state = await loadDeliveryManagementState(options.userKey);
  let target = state.orders.find(
    (order) => order.id === options.orderId || order.channelOrderId === options.orderId
  );
  let detailPayload: Record<string, unknown> | undefined;

  if (!target) {
    const detail = await getDeliveryOrderDetail(options.userKey, options.orderId);
    if (detail) {
      target = toTicketFromDetail(detail);
      detailPayload = detail.details;
      state.orders = [target, ...state.orders.filter((row) => row.id !== target?.id)];
    }
  }

  if (!target) {
    return {
      ok: false,
      statusCode: 404,
      message: 'order_not_found',
    };
  }

  if (!applyOrderStatusTransition(target.status, options.status)) {
    return {
      ok: false,
      statusCode: 409,
      message: `Invalid status transition: ${target.status} -> ${options.status}`,
      order: target,
    };
  }

  let warning: string | undefined;
  if (target.platform === 'ubereats') {
    const remote = await applyUberOrderAction({
      userKey: options.userKey,
      order: target,
      status: options.status,
      details: detailPayload,
    });

    if (!remote.ok && !remote.warning) {
      return {
        ok: false,
        statusCode: remote.httpStatus && remote.httpStatus >= 400 ? remote.httpStatus : 502,
        message: remote.message || 'ubereats_action_failed',
        order: target,
      };
    }

    if (remote.warning) {
      warning = remote.warning;
    }
  }

  const nextOrders = state.orders.map((order) =>
    order.id === target?.id ? { ...order, status: options.status } : order
  );

  const nextState = {
    ...state,
    orders: nextOrders,
    platforms: state.platforms.map((platform) => ({
      ...platform,
      queueSize: orderQueueForPlatform(nextOrders, platform.key),
    })),
  };

  await saveDeliveryManagementState(options.userKey, nextState);

  const nextOrder = nextOrders.find((order) => order.id === target?.id);
  return {
    ok: true,
    statusCode: 200,
    message: 'order_status_updated',
    warning,
    order: nextOrder,
  };
}
