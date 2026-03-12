import { NextResponse } from 'next/server';
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
import { resolveUberEatsAccessToken } from '@/lib/server/ubereats-token';

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
  const hasToken = Boolean(resolvedToken.token);

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
            accessRequestStatus: hasToken
              ? 'approved'
              : platform.accessRequestStatus,
            authStatus: hasToken ? 'connected' : platform.authStatus,
          }
        : platform
    ),
  };

  if (hasToken) {
    const allAuthorized = nextOnboarding.selectedPlatforms.every((key) => {
      const found = nextOnboarding.platformStates.find((entry) => entry.key === key);
      return found?.authStatus === 'connected';
    });
    if (allAuthorized) {
      nextOnboarding.checklist.authorizationCompleted = true;
    }
  }

  return {
    ...state,
    platforms: nextPlatforms,
    onboarding: nextOnboarding,
  };
}

function recalcPlatformQueues(state: DeliveryManagementState) {
  return state.platforms.map((platform) => ({
    ...platform,
    queueSize: orderQueueForPlatform(state.orders, platform.key),
  }));
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

function mergeWebhookOrders(
  state: DeliveryManagementState,
  events: Awaited<ReturnType<typeof listUberEatsWebhookEvents>>
): DeliveryManagementState {
  const webhookOrders = parseUberWebhookEventsToOrders(events);
  if (!webhookOrders.length) return state;

  const merged = new Map<string, DeliveryOrderTicket>();
  for (const order of state.orders) {
    merged.set(`state:${order.platform}:${order.id}`, order);
    merged.set(`state:${order.platform}:${order.channelOrderId}`, order);
  }

  for (const order of webhookOrders) {
    const keyById = `state:ubereats:${order.id}`;
    const keyByChannel = `state:ubereats:${order.channelOrderId}`;
    const existing = merged.get(keyById) || merged.get(keyByChannel);
    const next: DeliveryOrderTicket = {
      id: existing?.id ?? order.id,
      channelOrderId: order.channelOrderId,
      platform: 'ubereats',
      customerName: order.customerName,
      items: order.items.length ? order.items : existing?.items ?? [],
      amount: order.amount || existing?.amount || 0,
      status: order.status,
      placedAt: order.placedAt,
      etaMins: order.etaMins || existing?.etaMins || 0,
      notes: order.notes ?? existing?.notes,
    };
    merged.set(keyById, next);
    merged.set(keyByChannel, next);
  }

  const deduped = new Map<string, DeliveryOrderTicket>();
  for (const order of merged.values()) {
    const key = `${order.platform}:${order.id}`;
    if (!deduped.has(key)) deduped.set(key, order);
  }

  return {
    ...state,
    orders: [...deduped.values()].sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt)),
  };
}

async function mergeOrderQueryOrders(
  userKey: string,
  state: DeliveryManagementState
): Promise<DeliveryManagementState> {
  const queried = await queryDeliveryOrders(userKey, {});
  if (!queried.orders.length) return state;

  const merged = new Map<string, DeliveryOrderTicket>();
  for (const order of state.orders) {
    merged.set(`${order.platform}:${order.id}`, order);
  }

  for (const row of queried.orders) {
    const key = `${row.platform}:${row.id}`;
    const existing = merged.get(key);
    merged.set(key, {
      id: row.id,
      channelOrderId: row.channelOrderId,
      platform: row.platform,
      customerName: row.customerName,
      items: existing?.items ?? [],
      amount: row.amount,
      status: row.status,
      placedAt: row.placedAt,
      etaMins: row.etaMins,
      notes: existing?.notes,
    });
  }

  return {
    ...state,
    orders: [...merged.values()].sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt)),
  };
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

export async function GET() {
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const state = await loadDeliveryManagementState(userKey);
  const merged = await withLiveUberState(state, userKey);
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
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const payload = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_delivery_action', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const state = await withLiveUberState(await loadDeliveryManagementState(userKey), userKey);
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
    if (action.platformKey === 'ubereats') {
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
  const events = await listUberEatsWebhookEvents(20);
  const withEvents = mergeWebhookOrders(mergeWebhookPreview(next, events), events);
  const withQueriedOrders = await mergeOrderQueryOrders(userKey, withEvents);
  const withQueues: DeliveryManagementState = {
    ...withQueriedOrders,
    platforms: recalcPlatformQueues(withQueriedOrders),
  };
  return NextResponse.json(withQueues);
}
