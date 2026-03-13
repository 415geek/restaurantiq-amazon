import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import type {
  DeliveryHolidayHoursEntry,
  DeliveryPromotionDraft,
  DeliveryRegularHours,
  DeliveryStoreOnlineStatus,
  DeliveryStoreOperationsState,
} from '@/lib/delivery-management-types';
import {
  loadDeliveryManagementState,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';
import {
  ensureStoreOpsState,
  pullStoreOpsFromUber,
  pushStoreOpsToUber,
  setStoreOpsLocal,
  validateHolidayHours,
  validateRegularHours,
} from '@/lib/server/ubereats-store-ops';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';

export const runtime = 'nodejs';

const timeRangeSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

const regularHoursSchema = z.object({
  monday: z.array(timeRangeSchema).optional(),
  tuesday: z.array(timeRangeSchema).optional(),
  wednesday: z.array(timeRangeSchema).optional(),
  thursday: z.array(timeRangeSchema).optional(),
  friday: z.array(timeRangeSchema).optional(),
  saturday: z.array(timeRangeSchema).optional(),
  sunday: z.array(timeRangeSchema).optional(),
});

const holidayHoursSchema = z.array(
  z.object({
    id: z.string().min(1),
    date: z.string().min(1),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    closed: z.boolean().optional(),
  })
);

const promotionSchema = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['percentage', 'fixed_amount', 'bogo', 'threshold']),
    value: z.number().min(0),
    enabled: z.boolean(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    target: z.enum(['store', 'menu_item']),
    targetIds: z.array(z.string()),
    syncStatus: z.enum(['idle', 'pending', 'synced', 'error']),
    lastError: z.string().optional(),
  })
);

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('save_local'),
    storeId: z.string().min(1),
    onlineStatus: z.enum(['online', 'paused']),
    prepTimeOffsetMins: z.number().min(-120).max(120),
    defaultPrepTimeMins: z.number().min(1).max(240),
    regularHours: regularHoursSchema,
    holidayHours: holidayHoursSchema,
    promotions: promotionSchema,
  }),
  z.object({
    type: z.literal('pull_live'),
    storeId: z.string().min(1),
  }),
  z.object({
    type: z.literal('push_live'),
    storeId: z.string().min(1),
  }),
]);

function pickStore(
  storeOps: DeliveryStoreOperationsState[],
  storeId?: string | null
): DeliveryStoreOperationsState | null {
  if (!storeOps.length) return null;
  if (!storeId) return storeOps[0];
  return storeOps.find((item) => item.storeId === storeId) || null;
}

function normalizeStoreOpsInput(input: {
  storeId: string;
  onlineStatus: DeliveryStoreOnlineStatus;
  prepTimeOffsetMins: number;
  defaultPrepTimeMins: number;
  regularHours: DeliveryRegularHours;
  holidayHours: DeliveryHolidayHoursEntry[];
  promotions: DeliveryPromotionDraft[];
}): DeliveryStoreOperationsState {
  return {
    storeId: input.storeId,
    storeName: input.storeId,
    onlineStatus: input.onlineStatus,
    prepTimeOffsetMins: input.prepTimeOffsetMins,
    defaultPrepTimeMins: input.defaultPrepTimeMins,
    regularHours: input.regularHours,
    holidayHours: input.holidayHours,
    promotions: input.promotions,
    syncSource: 'local',
    syncWarnings: [],
    lastPulledAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  const isDemo = Boolean(demoId);

  const { userId } = await auth();
  const userKey = isDemo && demoId ? demoUserKey(demoId) : (userId ?? 'anonymous');

  const storeId = req.nextUrl.searchParams.get('storeId');
  const refresh = req.nextUrl.searchParams.get('refresh') === 'true';

  let state = ensureStoreOpsState(await loadDeliveryManagementState(userKey), userKey);

  if (!isDemo && refresh) {
    const selected = pickStore(state.storeOps, storeId);
    if (selected) {
      const live = await pullStoreOpsFromUber({ userKey, storeOps: selected });
      state = setStoreOpsLocal(state, {
        ...selected,
        ...live.next,
        storeName: selected.storeName,
      });
      state = await saveDeliveryManagementState(userKey, state);
    }
  }

  const selected = pickStore(state.storeOps, storeId);

  return NextResponse.json({
    selectedStoreId: selected?.storeId ?? null,
    stores: state.storeOps.map((store) => ({
      storeId: store.storeId,
      storeName: store.storeName,
      onlineStatus: store.onlineStatus,
      syncSource: store.syncSource,
      lastPulledAt: store.lastPulledAt,
      lastPushedAt: store.lastPushedAt,
    })),
    storeOps: state.storeOps,
    updatedAt: state.updatedAt,
    warning: isDemo ? 'Demo mode: store operations are mock data.' : undefined,
  });
}

export async function PATCH(req: NextRequest) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  const isDemo = Boolean(demoId);

  const { userId } = await auth();
  const userKey = isDemo && demoId ? demoUserKey(demoId) : (userId ?? 'anonymous');

  const payload = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_store_ops_action',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  let state = ensureStoreOpsState(await loadDeliveryManagementState(userKey), userKey);
  const action = parsed.data;
  const selected = pickStore(state.storeOps, action.storeId);

  if (!selected) {
    return NextResponse.json(
      {
        error: 'store_not_found',
      },
      { status: 404 }
    );
  }

  if (action.type === 'save_local') {
    const regularErrors = validateRegularHours(action.regularHours);
    const holidayErrors = validateHolidayHours(action.holidayHours);
    const validationErrors = [...regularErrors, ...holidayErrors];
    if (validationErrors.length) {
      return NextResponse.json(
        {
          error: 'invalid_store_ops_payload',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    const nextStore = {
      ...selected,
      ...normalizeStoreOpsInput({
        storeId: action.storeId,
        onlineStatus: action.onlineStatus,
        prepTimeOffsetMins: action.prepTimeOffsetMins,
        defaultPrepTimeMins: action.defaultPrepTimeMins,
        regularHours: action.regularHours,
        holidayHours: action.holidayHours,
        promotions: action.promotions,
      }),
      storeName: selected.storeName,
      lastPulledAt: new Date().toISOString(),
    } satisfies DeliveryStoreOperationsState;

    state = setStoreOpsLocal(state, nextStore);
    state = await saveDeliveryManagementState(userKey, state);

    return NextResponse.json({
      ok: true,
      message: 'store_ops_saved_local',
      storeOps: state.storeOps,
      selectedStoreId: action.storeId,
      updatedAt: state.updatedAt,
      warning: isDemo ? 'Demo mode: changes saved locally only.' : undefined,
    });
  }

  if (isDemo) {
    return NextResponse.json(
      {
        ok: false,
        error: 'demo_mode_live_sync_disabled',
        message: 'Demo mode: live pull/push is disabled.',
      },
      { status: 400 }
    );
  }

  if (action.type === 'pull_live') {
    const live = await pullStoreOpsFromUber({ userKey, storeOps: selected });
    const nextStore = {
      ...selected,
      ...live.next,
      storeName: selected.storeName,
    };
    state = setStoreOpsLocal(state, nextStore);
    state = await saveDeliveryManagementState(userKey, state);

    return NextResponse.json({
      ok: true,
      message: 'store_ops_pulled_live',
      warnings: live.warnings,
      storeOps: state.storeOps,
      selectedStoreId: action.storeId,
      updatedAt: state.updatedAt,
    });
  }

  const push = await pushStoreOpsToUber({
    userKey,
    storeOps: selected,
  });

  const nextStore: DeliveryStoreOperationsState = {
    ...selected,
    syncWarnings: push.warnings,
    lastPushedAt: push.pushedAt,
    syncSource: push.ok ? 'live' : 'local',
    promotions: selected.promotions.map((promotion) => {
      if (!promotion.enabled) return promotion;
      return {
        ...promotion,
        syncStatus: push.ok ? 'synced' : 'error',
        lastError: push.ok ? undefined : (push.warnings[0] || 'push_failed'),
      };
    }),
  };

  state = setStoreOpsLocal(state, nextStore);
  state = await saveDeliveryManagementState(userKey, state);

  return NextResponse.json({
    ok: true,
    message: push.ok ? 'store_ops_pushed_live' : 'store_ops_pushed_with_errors',
    warnings: push.warnings,
    storeOps: state.storeOps,
    selectedStoreId: action.storeId,
    updatedAt: state.updatedAt,
  });
}