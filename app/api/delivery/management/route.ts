import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import type {
  DeliveryManagementState,
  DeliveryOnboardingStep,
  DeliveryOrderTicket,
  DeliveryOrderStatus,
  DeliveryPlatformKey,
  DeliverySubscriptionPlan,
} from '@/lib/delivery-management-types';
import {
  applyOrderStatusTransition,
  loadDeliveryManagementState,
  orderQueueForPlatform,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';
import {
  clearUberEatsConnectionState,
  getUberEatsConnectionState,
} from '@/lib/server/ubereats-oauth-store';
import { listUberEatsWebhookEvents } from '@/lib/server/ubereats-webhook-store';
import { parseUberWebhookEventsToOrders } from '@/lib/server/ubereats-order-normalizer';
import { queryDeliveryOrders } from '@/lib/server/delivery-order-query';
import { isIntegrationConnected } from '@/lib/server/integration-store';
import { resolveUberEatsAccessToken } from '@/lib/server/ubereats-token';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';

export const runtime = 'nodejs';

const platformKeySchema = z.enum([
  'ubereats',
  'doordash',
  'grubhub',
  'fantuan',
  'hungrypanda',
]);

const orderStatusSchema = z.enum([
  'new',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
]);

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_onboarding_step'),
    step: z.enum(['platforms', 'subscription', 'authorization', 'sync', 'operations']),
  }),
  z.object({
    type: z.literal('set_selected_platforms'),
    platformKeys: z.array(platformKeySchema).min(1),
  }),
  z.object({
    type: z.literal('request_platform_access'),
    platformKey: platformKeySchema,
  }),
  z.object({
    type: z.literal('set_subscription_plan'),
    plan: z.enum(['starter', 'growth', 'enterprise']),
    active: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('set_platform_auth_status'),
    platformKey: platformKeySchema,
    status: z.enum(['not_started', 'pending', 'connected', 'failed']),
  }),
  z.object({
    type: z.literal('disconnect_platform'),
    platformKey: platformKeySchema,
  }),
  z.object({
    type: z.literal('run_initial_sync'),
  }),
  z.object({
    type: z.literal('mark_go_live_ready'),
    ready: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('toggle_platform_acceptance'),
    platformKey: platformKeySchema,
    acceptsOrders: z.boolean(),
  }),
  z.object({
    type: z.literal('toggle_menu_item'),
    itemId: z.string().min(1),
    available: z.boolean(),
  }),
  z.object({
    type: z.literal('update_menu_base_price'),
    itemId: z.string().min(1),
    basePrice: z.number().min(0),
  }),
  z.object({
    type: z.literal('update_channel_price'),
    itemId: z.string().min(1),
    platformKey: platformKeySchema,
    enabled: z.boolean(),
    price: z.number().min(0),
  }),
  z.object({
    type: z.literal('update_order_status'),
    orderId: z.string().min(1),
    status: orderStatusSchema,
  }),
  z.object({
    type: z.literal('save_automation'),
    automation: z.object({
      autoAcceptLowRisk: z.boolean(),
      maxAutoAcceptAmount: z.number().min(0).max(500),
      pauseWhenQueueExceeds: z.number().min(1).max(80),
      prepBufferMins: z.number().min(0).max(30),
      weekendMarkupPct: z.number().min(0).max(40),
    }),
  }),
  z.object({
    type: z.literal('publish_menu'),
  }),
]);

async function withLiveUberState(
  state: DeliveryManagementState,
  userKey: string
): Promise<DeliveryManagementState> {
  const userConnection = getUberEatsConnectionState(userKey);
  const resolvedToken = await resolveUberEatsAccessToken(userKey);
  const connectedInIntegrationStore = await isIntegrationConnected('ubereats');
  const hasToken = Boolean(resolvedToken.token) || connectedInIntegrationStore;

  const nextPlatforms = state.platforms.map((platform) => {
    if (platform.key !== 'ubereats') return platform;
    return {
      ...platform,
      status: hasToken ? 'connected' : platform.status,
      acceptsOrders: hasToken ? true : platform.acceptsOrders,
      menuSyncedAt: hasToken ? platform.menuSyncedAt || new Date().toISOString() : platform.menuSyncedAt,
    };
  });

  const nextOnboarding = {
    ...state.onboarding,
    platformStates: state.onboarding.platformStates.map((platform) =>
      platform.key === 'ubereats'
        ? {
            ...platform,
            authStatus: hasToken ? 'connected' : platform.authStatus,
            syncStatus: hasToken ? 'synced' : platform.syncStatus,
            lastSyncAt: hasToken ? platform.lastSyncAt || new Date().toISOString() : platform.lastSyncAt,
            note: hasToken
              ? platform.note || `Connected (token expires ${new Date(userConnection?.accessTokenExpiresAt || Date.now()).toLocaleString()}).`
              : platform.note,
          }
        : platform
    ),
  };

  return {
    ...state,
    platforms: nextPlatforms,
    onboarding: nextOnboarding,
  };
}

function mergeWebhookPreview(state: DeliveryManagementState, events: Awaited<ReturnType<typeof listUberEatsWebhookEvents>>): DeliveryManagementState {
  return {
    ...state,
    webhookEvents: events.map((event) => ({
      id: event.id,
      receivedAt: event.receivedAt,
      topic: event.topic,
      eventType: event.eventType,
      storeId: event.storeId,
    })),
  };
}

function mergeWebhookOrders(state: DeliveryManagementState, events: Awaited<ReturnType<typeof listUberEatsWebhookEvents>>): DeliveryManagementState {
  const orders = parseUberWebhookEventsToOrders(events);
  const merged = new Map(state.orders.map((order) => [order.id, order] as const));
  for (const order of orders) {
    merged.set(order.id, {
      id: order.id,
      channelOrderId: order.channelOrderId,
      platform: 'ubereats',
      customerName: order.customerName,
      items: order.items,
      amount: order.amount,
      status: order.status,
      placedAt: order.placedAt,
      etaMins: order.etaMins,
      notes: order.notes,
    });
  }

  return {
    ...state,
    orders: [...merged.values()].sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt)),
  };
}

async function mergeOrderQueryOrders(userKey: string, state: DeliveryManagementState): Promise<DeliveryManagementState> {
  const response = await queryDeliveryOrders(userKey, {
    platform: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    customer: undefined,
    q: undefined,
  });

  const merged = new Map(state.orders.map((order) => [order.id, order] as const));
  for (const row of response.orders) {
    if (merged.has(row.id)) continue;
    merged.set(row.id, {
      id: row.id,
      channelOrderId: row.channelOrderId,
      platform: row.platform,
      customerName: row.customerName,
      items: [],
      amount: row.amount,
      status: row.status,
      placedAt: row.placedAt,
      etaMins: row.etaMins,
    });
  }
  return {
    ...state,
    orders: [...merged.values()].sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt)),
  };
}

function recalcPlatformQueues(state: DeliveryManagementState) {
  return state.platforms.map((platform) => ({
    ...platform,
    queueSize: orderQueueForPlatform(state.orders, platform.key),
    avgPrepMins: platform.avgPrepMins || 18,
  }));
}

const onboardingStepOrder: DeliveryOnboardingStep[] = [
  'platforms',
  'subscription',
  'authorization',
  'sync',
  'operations',
];

function ensureUniquePlatformList(keys: DeliveryPlatformKey[]) {
  return Array.from(new Set(keys));
}

function progressOnboardingTo(state: DeliveryManagementState, step: DeliveryOnboardingStep) {
  state.onboarding.step = step;
  const stepIndex = onboardingStepOrder.indexOf(step);
  state.onboarding.checklist.requestSubmitted =
    stepIndex >= onboardingStepOrder.indexOf('subscription') ||
    state.onboarding.checklist.requestSubmitted;
  state.onboarding.checklist.subscriptionActivated =
    stepIndex >= onboardingStepOrder.indexOf('authorization') ||
    state.onboarding.checklist.subscriptionActivated;
  state.onboarding.checklist.authorizationCompleted =
    stepIndex >= onboardingStepOrder.indexOf('sync') ||
    state.onboarding.checklist.authorizationCompleted;
  state.onboarding.checklist.initialSyncCompleted =
    stepIndex >= onboardingStepOrder.indexOf('operations') ||
    state.onboarding.checklist.initialSyncCompleted;
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

  const state = await loadDeliveryManagementState(userKey);
  const merged = await withLiveUberState(state, userKey);

  if (isDemo) {
    return NextResponse.json({
      ...merged,
      platforms: recalcPlatformQueues(merged),
    });
  }

  const events = await listUberEatsWebhookEvents(20);
  const withEvents = mergeWebhookOrders(mergeWebhookPreview(merged, events), events);
  const withQueriedOrders = await mergeOrderQueryOrders(userKey, withEvents);
  const withQueues: DeliveryManagementState = {
    ...withQueriedOrders,
    platforms: recalcPlatformQueues(withQueriedOrders),
  };
  return NextResponse.json(withQueues);
}

export async function PATCH(req: Request) {
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

  const payload = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_delivery_action', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const state = isDemo
    ? await loadDeliveryManagementState(userKey)
    : await withLiveUberState(await loadDeliveryManagementState(userKey), userKey);

  const action = parsed.data;

  if (action.type === 'set_onboarding_step') {
    progressOnboardingTo(state, action.step);
  } else if (action.type === 'set_selected_platforms') {
    state.onboarding.selectedPlatforms = ensureUniquePlatformList(action.platformKeys);
    state.onboarding.step = 'subscription';
    state.onboarding.checklist.requestSubmitted = true;
  } else if (action.type === 'request_platform_access') {
    state.onboarding.selectedPlatforms = ensureUniquePlatformList([
      ...state.onboarding.selectedPlatforms,
      action.platformKey,
    ]);
    state.onboarding.platformStates = state.onboarding.platformStates.map((platform) =>
      platform.key === action.platformKey
        ? { ...platform, accessRequestStatus: 'requested', note: 'Tech support request submitted' }
        : platform
    );
    state.onboarding.checklist.requestSubmitted = true;
  } else if (action.type === 'set_subscription_plan') {
    state.onboarding.subscriptionPlan = action.plan as DeliverySubscriptionPlan;
    state.onboarding.subscriptionActive =
      typeof action.active === 'boolean' ? action.active : true;
    state.onboarding.checklist.subscriptionActivated = state.onboarding.subscriptionActive;
    state.onboarding.step = 'authorization';
  } else if (action.type === 'set_platform_auth_status') {
    state.onboarding.platformStates = state.onboarding.platformStates.map((platform) =>
      platform.key === action.platformKey
        ? { ...platform, authStatus: action.status }
        : platform
    );
    const allAuthorized = state.onboarding.selectedPlatforms.every((key) => {
      const found = state.onboarding.platformStates.find((entry) => entry.key === key);
      return found?.authStatus === 'connected';
    });
    state.onboarding.checklist.authorizationCompleted = allAuthorized;
    if (allAuthorized) state.onboarding.step = 'sync';
  } else if (action.type === 'disconnect_platform') {
    if (!isDemo && action.platformKey === 'ubereats') {
      clearUberEatsConnectionState(userKey);
    }
    state.onboarding.selectedPlatforms = state.onboarding.selectedPlatforms.filter(
      (key) => key !== action.platformKey
    );
    state.onboarding.platformStates = state.onboarding.platformStates.map((platform) =>
      platform.key === action.platformKey
        ? {
            ...platform,
            accessRequestStatus: 'not_requested',
            authStatus: 'not_started',
            syncStatus: 'idle',
            lastSyncAt: undefined,
            note: undefined,
          }
        : platform
    );
    state.platforms = state.platforms.map((platform) =>
      platform.key === action.platformKey
        ? {
            ...platform,
            status: 'not_connected',
            acceptsOrders: false,
            menuSyncedAt: undefined,
          }
        : platform
    );
    const allAuthorized = state.onboarding.selectedPlatforms.every((key) => {
      const found = state.onboarding.platformStates.find((entry) => entry.key === key);
      return found?.authStatus === 'connected';
    });
    state.onboarding.checklist.authorizationCompleted = allAuthorized;
    state.onboarding.checklist.initialSyncCompleted = state.platforms.some(
      (platform) => platform.status === 'connected'
    );
    state.onboarding.checklist.goLiveReady = state.platforms.some(
      (platform) => platform.status === 'connected'
    );
    if (!state.platforms.some((platform) => platform.status === 'connected')) {
      state.onboarding.step = 'platforms';
    }
  } else if (action.type === 'run_initial_sync') {
    const now = new Date().toISOString();
    state.onboarding.platformStates = state.onboarding.platformStates.map((platform) => {
      if (!state.onboarding.selectedPlatforms.includes(platform.key)) return platform;
      const authStatus = platform.key === 'ubereats' ? 'connected' : platform.authStatus;
      const syncStatus = authStatus === 'connected' ? 'synced' : 'error';
      return {
        ...platform,
        authStatus,
        syncStatus,
        lastSyncAt: syncStatus === 'synced' ? now : platform.lastSyncAt,
        note:
          syncStatus === 'synced'
            ? 'Initial data sync completed.'
            : 'Waiting for authorization.',
      };
    });
    state.platforms = state.platforms.map((platform) => {
      if (!state.onboarding.selectedPlatforms.includes(platform.key)) return platform;
      const onboardingPlatform = state.onboarding.platformStates.find(
        (entry) => entry.key === platform.key
      );
      const connected = onboardingPlatform?.syncStatus === 'synced';
      return {
        ...platform,
        status: connected ? 'connected' : platform.status,
        acceptsOrders: connected ? true : platform.acceptsOrders,
        menuSyncedAt: connected ? now : platform.menuSyncedAt,
      };
    });
    state.onboarding.checklist.initialSyncCompleted = true;
    state.onboarding.step = 'operations';
  } else if (action.type === 'mark_go_live_ready') {
    const ready = typeof action.ready === 'boolean' ? action.ready : true;
    state.onboarding.checklist.goLiveReady = ready;
    if (ready) state.onboarding.step = 'operations';
  } else if (action.type === 'toggle_platform_acceptance') {
    state.platforms = state.platforms.map((platform) =>
      platform.key === action.platformKey
        ? { ...platform, acceptsOrders: action.acceptsOrders }
        : platform
    );
  } else if (action.type === 'toggle_menu_item') {
    state.menu = state.menu.map((item) =>
      item.id === action.itemId ? { ...item, available: action.available } : item
    );
  } else if (action.type === 'update_menu_base_price') {
    state.menu = state.menu.map((item) =>
      item.id === action.itemId ? { ...item, basePrice: action.basePrice } : item
    );
  } else if (action.type === 'update_channel_price') {
    state.menu = state.menu.map((item) => {
      if (item.id !== action.itemId) return item;
      return {
        ...item,
        channels: {
          ...item.channels,
          [action.platformKey]: {
            enabled: action.enabled,
            price: action.price,
          },
        },
        available: action.enabled ? true : item.available,
        stock: item.stock === 'out' && action.enabled ? 'low' : item.stock,
      };
    });
  } else if (action.type === 'update_order_status') {
    state.orders = state.orders.map((order) => {
      if (order.id !== action.orderId) return order;
      const nextStatus = action.status as DeliveryOrderStatus;
      if (!applyOrderStatusTransition(order.status, nextStatus)) return order;
      return {
        ...order,
        status: nextStatus,
      };
    });
  } else if (action.type === 'save_automation') {
    state.automation = action.automation;
  } else if (action.type === 'publish_menu') {
    const publishTime = new Date().toISOString();
    state.lastPublishedAt = publishTime;
    state.platforms = state.platforms.map((platform) =>
      platform.status === 'connected'
        ? { ...platform, menuSyncedAt: publishTime }
        : platform
    );
  }

  state.platforms = recalcPlatformQueues(state);
  const next = await saveDeliveryManagementState(userKey, state);

  if (isDemo) {
    return NextResponse.json({
      ...next,
      platforms: recalcPlatformQueues(next),
    });
  }

  const events = await listUberEatsWebhookEvents(20);
  const withEvents = mergeWebhookOrders(mergeWebhookPreview(next, events), events);
  const withQueriedOrders = await mergeOrderQueryOrders(userKey, withEvents);
  const withQueues: DeliveryManagementState = {
    ...withQueriedOrders,
    platforms: recalcPlatformQueues(withQueriedOrders),
  };
  return NextResponse.json(withQueues);
}