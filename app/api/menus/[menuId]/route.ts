import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import {
  loadDeliveryManagementState,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';
import type {
  DeliveryManagementState,
  DeliveryPlatformKey,
  MenuPlatformKey,
} from '@/lib/delivery-management-types';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';

export const runtime = 'nodejs';

const platformSchema = z.enum(['ubereats', 'doordash', 'grubhub', 'fantuan', 'hungrypanda', 'pos']);
const deliveryPlatformSchema = z.enum(['ubereats', 'doordash', 'grubhub', 'fantuan', 'hungrypanda']);

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rename'), name: z.string().min(1).max(80) }),
  z.object({ type: z.literal('set_platforms'), platforms: z.array(platformSchema).min(1) }),
  z.object({ type: z.literal('set_item_included'), itemId: z.string().min(1), included: z.boolean() }),
  z.object({
    type: z.literal('set_item_price_override'),
    itemId: z.string().min(1),
    priceOverride: z.number().min(0).nullable(),
  }),
  z.object({
    type: z.literal('set_item_channel'),
    itemId: z.string().min(1),
    platformKey: deliveryPlatformSchema,
    enabled: z.boolean(),
    price: z.number().min(0).nullable(),
  }),
  z.object({ type: z.literal('delete_menu') }),
]);

function resolveUserKey(req: NextRequest, userId: string | null) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  if (demoId) return demoUserKey(demoId);
  return userId ?? 'anonymous';
}

function updateBranch(
  state: DeliveryManagementState,
  menuId: string,
  update: (branch: DeliveryManagementState['menuBranches'][number]) => DeliveryManagementState['menuBranches'][number]
) {
  const found = state.menuBranches.find((m) => m.id === menuId);
  if (!found) return null;
  const next = update(found);
  return {
    ...state,
    menuBranches: state.menuBranches.map((m) => (m.id === menuId ? next : m)),
  };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ menuId: string }> }
) {
  const { userId } = await auth();
  const userKey = resolveUserKey(req, userId);
  const { menuId } = await context.params;

  const payload = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const action = parsed.data;

  const state = await loadDeliveryManagementState(userKey);
  const branch = state.menuBranches.find((m) => m.id === menuId);
  if (!branch) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  let nextState: DeliveryManagementState | null = null;

  if (action.type === 'rename') {
    nextState = updateBranch(state, menuId, (m) => ({
      ...m,
      name: action.name,
      updatedAt: new Date().toISOString(),
    }));
  } else if (action.type === 'set_platforms') {
    nextState = updateBranch(state, menuId, (m) => ({
      ...m,
      platforms: action.platforms as MenuPlatformKey[],
      updatedAt: new Date().toISOString(),
    }));
  } else if (action.type === 'set_item_included') {
    nextState = updateBranch(state, menuId, (m) => ({
      ...m,
      updatedAt: new Date().toISOString(),
      items: m.items.map((row) =>
        row.itemId === action.itemId ? { ...row, included: action.included } : row
      ),
    }));
  } else if (action.type === 'set_item_price_override') {
    nextState = updateBranch(state, menuId, (m) => ({
      ...m,
      updatedAt: new Date().toISOString(),
      items: m.items.map((row) =>
        row.itemId === action.itemId
          ? {
              ...row,
              priceOverride:
                typeof action.priceOverride === 'number' ? action.priceOverride : undefined,
            }
          : row
      ),
    }));
  } else if (action.type === 'set_item_channel') {
    nextState = updateBranch(state, menuId, (m) => ({
      ...m,
      updatedAt: new Date().toISOString(),
      items: m.items.map((row) => {
        if (row.itemId !== action.itemId) return row;
        const channels = { ...(row.channels || {}) };
        const platformKey = action.platformKey as DeliveryPlatformKey;
        channels[platformKey] = {
          enabled: action.enabled,
          ...(typeof action.price === 'number' ? { price: action.price } : {}),
        };
        return {
          ...row,
          channels,
        };
      }),
    }));
  } else if (action.type === 'delete_menu') {
    nextState = {
      ...state,
      menuBranches: state.menuBranches.filter((m) => m.id !== menuId),
    };
  }

  if (!nextState) {
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 400 });
  }

  const saved = await saveDeliveryManagementState(userKey, nextState);

  return NextResponse.json({
    ok: true,
    branches: saved.menuBranches,
    updatedAt: saved.updatedAt,
  });
}