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
  MenuBranch,
  MenuPlatformKey,
} from '@/lib/delivery-management-types';
import { createMenuBranch, computeBranchEffectiveMenu } from '@/lib/server/menu-branches';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(80),
  platforms: z.array(z.enum(['ubereats', 'doordash', 'grubhub', 'fantuan', 'hungrypanda', 'pos'])).min(1),
  fromMenuId: z.string().optional(),
});

function resolveUserKey(req: NextRequest, userId: string | null) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  if (demoId) return demoUserKey(demoId);
  return userId ?? 'anonymous';
}

function pickBranch(state: DeliveryManagementState, menuId?: string) {
  if (!menuId || menuId === 'default') return null;
  return state.menuBranches.find((m) => m.id === menuId) || null;
}

function cloneBranchAsItems(state: DeliveryManagementState, fromBranch: MenuBranch): MenuBranch['items'] {
  const effective = computeBranchEffectiveMenu({
    defaultMenu: state.menu,
    branch: fromBranch,
  });

  return effective.map((row) => {
    const channels: NonNullable<MenuBranch['items'][number]['channels']> = {};
    for (const [key, cfg] of Object.entries(row.channels) as Array<[
      DeliveryPlatformKey,
      { enabled: boolean; price: number }
    ]>) {
      channels[key] = { enabled: cfg.enabled, price: cfg.price };
    }

    return {
      itemId: row.id,
      included: true,
      // preserve menu price as override relative to default
      priceOverride: row.basePrice,
      channels,
    };
  });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const userKey = resolveUserKey(req, userId);
  const state = await loadDeliveryManagementState(userKey);
  return NextResponse.json({
    ok: true,
    defaultMenu: state.menu,
    branches: state.menuBranches,
    platforms: state.platforms,
    updatedAt: state.updatedAt,
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const userKey = resolveUserKey(req, userId);

  const payload = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const state = await loadDeliveryManagementState(userKey);

  let items: MenuBranch['items'] = state.menu.map((item) => ({ itemId: item.id, included: false }));
  const from = parsed.data.fromMenuId ? pickBranch(state, parsed.data.fromMenuId) : null;
  if (parsed.data.fromMenuId === 'default') {
    items = state.menu.map((item) => ({ itemId: item.id, included: true }));
  } else if (from) {
    items = cloneBranchAsItems(state, from);
  }

  const branch = createMenuBranch({
    name: parsed.data.name,
    platforms: parsed.data.platforms as MenuPlatformKey[],
    items,
  });

  const next: DeliveryManagementState = {
    ...state,
    menuBranches: [branch, ...state.menuBranches],
  };

  const saved = await saveDeliveryManagementState(userKey, next);

  return NextResponse.json({
    ok: true,
    branch,
    branches: saved.menuBranches,
    updatedAt: saved.updatedAt,
  });
}