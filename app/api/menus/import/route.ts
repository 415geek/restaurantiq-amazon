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
  MenuBranchItem,
  MenuPlatformKey,
} from '@/lib/delivery-management-types';
import { createMenuBranch, upsertDefaultMenuItem } from '@/lib/server/menu-branches';
import { parseMenuFromPdf, parseMenuFromUrl } from '@/lib/server/menu-import';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';

export const runtime = 'nodejs';

const methodSchema = z.enum(['pdf', 'url']);
const platformSchema = z.enum(['ubereats', 'doordash', 'grubhub', 'fantuan', 'hungrypanda', 'pos']);

function resolveUserKey(req: NextRequest, userId: string | null) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  if (demoId) return demoUserKey(demoId);
  return userId ?? 'anonymous';
}

function buildBranchItem(params: {
  defaultItemId: string;
  defaultBasePrice: number;
  parsedPrice?: number;
  platforms: MenuPlatformKey[];
}): MenuBranchItem {
  const priceOverride =
    typeof params.parsedPrice === 'number' &&
    Number.isFinite(params.parsedPrice) &&
    params.parsedPrice > 0 &&
    Math.abs(params.parsedPrice - params.defaultBasePrice) > 0.009
      ? params.parsedPrice
      : undefined;

  const deliveryPlatforms: DeliveryPlatformKey[] = [
    'ubereats',
    'doordash',
    'grubhub',
    'fantuan',
    'hungrypanda',
  ];

  const channels: MenuBranchItem['channels'] = {};
  for (const key of deliveryPlatforms) {
    const enabled = params.platforms.includes(key);
    channels[key] = enabled ? { enabled } : { enabled: false };
  }

  return {
    itemId: params.defaultItemId,
    included: true,
    priceOverride,
    channels,
  };
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const userKey = resolveUserKey(req, userId);

  const form = await req.formData();
  const name = String(form.get('name') || '').trim();
  const methodRaw = String(form.get('method') || '').trim();
  const platformsRaw = String(form.get('platforms') || '').trim();

  const methodParsed = methodSchema.safeParse(methodRaw);
  if (!methodParsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_method' }, { status: 400 });
  }

  const platforms = platformsRaw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const platformsParsed = z.array(platformSchema).min(1).safeParse(platforms);
  if (!platformsParsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_platforms' }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 });
  }

  const state = await loadDeliveryManagementState(userKey);

  let importedItems: Array<{ name: string; category?: string; price?: number }> = [];
  const warnings: string[] = [];

  if (methodParsed.data === 'pdf') {
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file_required' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseMenuFromPdf(bytes);
    importedItems = parsed.items;
    warnings.push(...parsed.warnings);
  }

  if (methodParsed.data === 'url') {
    const url = String(form.get('url') || '').trim();
    if (!url) {
      return NextResponse.json({ ok: false, error: 'url_required' }, { status: 400 });
    }
    const parsed = await parseMenuFromUrl(url);
    importedItems = parsed.items;
    warnings.push(...parsed.warnings);
  }

  if (!importedItems.length) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no_items_extracted',
        warnings,
      },
      { status: 400 }
    );
  }

  let nextState: DeliveryManagementState = state;
  const branchItems: MenuBranchItem[] = [];

  for (const parsed of importedItems) {
    const upsert = upsertDefaultMenuItem(nextState.menu, {
      name: parsed.name,
      category: parsed.category,
      basePrice: parsed.price,
    });

    if (upsert.isNew) {
      nextState = { ...nextState, menu: upsert.nextMenu };
    }

    const base = nextState.menu.find((row) => row.id === upsert.itemId);
    if (!base) continue;

    branchItems.push(
      buildBranchItem({
        defaultItemId: base.id,
        defaultBasePrice: base.basePrice,
        parsedPrice: parsed.price,
        platforms: platformsParsed.data as MenuPlatformKey[],
      })
    );
  }

  // Ensure the branch knows about all default items (for later include/exclude UX)
  const allDefault = nextState.menu.map((item) => ({ itemId: item.id, included: false }));
  const byId = new Set(branchItems.map((row) => row.itemId));
  const mergedItems = [...branchItems, ...allDefault.filter((row) => !byId.has(row.itemId))];

  const branch = createMenuBranch({
    name,
    platforms: platformsParsed.data as MenuPlatformKey[],
    items: mergedItems,
  });

  nextState = {
    ...nextState,
    menuBranches: [branch, ...nextState.menuBranches],
  };

  const saved = await saveDeliveryManagementState(userKey, nextState);

  return NextResponse.json({
    ok: true,
    branch,
    warnings,
    defaultMenuUpdated: saved.menu.length !== state.menu.length,
    branches: saved.menuBranches,
    updatedAt: saved.updatedAt,
  });
}