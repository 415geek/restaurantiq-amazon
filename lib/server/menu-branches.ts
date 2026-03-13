import type {
  DeliveryMenuItem,
  DeliveryPlatformKey,
  MenuBranch,
  MenuBranchItem,
  MenuPlatformKey,
} from '@/lib/delivery-management-types';

function nowIso() {
  return new Date().toISOString();
}

function slugFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40);
}

export function createMenuBranch(params: {
  name: string;
  platforms: MenuPlatformKey[];
  items: MenuBranchItem[];
}): MenuBranch {
  const createdAt = nowIso();
  const id = `menu-${slugFromName(params.name) || 'branch'}-${Date.now()}`;
  return {
    id,
    name: params.name.trim() || 'New menu',
    parentId: 'default',
    platforms: params.platforms,
    createdAt,
    updatedAt: createdAt,
    items: params.items,
  };
}

function normalizeNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function upsertDefaultMenuItem(
  defaultMenu: DeliveryMenuItem[],
  item: { name: string; category?: string; basePrice?: number }
): { nextMenu: DeliveryMenuItem[]; itemId: string; isNew: boolean } {
  const key = normalizeNameKey(item.name);
  const existing = defaultMenu.find((row) => normalizeNameKey(row.name) === key);
  if (existing) {
    return {
      nextMenu: defaultMenu,
      itemId: existing.id,
      isNew: false,
    };
  }

  const id = `m-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const basePrice = typeof item.basePrice === 'number' && Number.isFinite(item.basePrice) ? item.basePrice : 0;
  const next: DeliveryMenuItem = {
    id,
    name: item.name.trim() || `Item ${id}`,
    category: item.category?.trim() || 'General',
    basePrice,
    stock: 'in_stock',
    available: true,
    channels: {},
  };

  return {
    nextMenu: [next, ...defaultMenu],
    itemId: id,
    isNew: true,
  };
}

export function computeBranchEffectiveMenu(params: {
  defaultMenu: DeliveryMenuItem[];
  branch: MenuBranch;
}): DeliveryMenuItem[] {
  const baseById = new Map(params.defaultMenu.map((item) => [item.id, item] as const));
  const platformSet = new Set(params.branch.platforms);
  const deliveryPlatforms: DeliveryPlatformKey[] = [
    'ubereats',
    'doordash',
    'grubhub',
    'fantuan',
    'hungrypanda',
  ];

  const rows: DeliveryMenuItem[] = [];
  for (const entry of params.branch.items) {
    if (!entry.included) continue;
    const base = baseById.get(entry.itemId);
    if (!base) continue;

    const effectivePrice =
      typeof entry.priceOverride === 'number' && Number.isFinite(entry.priceOverride)
        ? entry.priceOverride
        : base.basePrice;

    const effectiveAvailable =
      typeof entry.availableOverride === 'boolean' ? entry.availableOverride : base.available;
    const effectiveStock = entry.stockOverride ?? base.stock;

    const channels: DeliveryMenuItem['channels'] = {};

    for (const platformKey of deliveryPlatforms) {
      const channelOverride = entry.channels?.[platformKey];
      const enabled =
        typeof channelOverride?.enabled === 'boolean'
          ? channelOverride.enabled
          : platformSet.has(platformKey);
      const price =
        typeof channelOverride?.price === 'number' && Number.isFinite(channelOverride.price)
          ? channelOverride.price
          : effectivePrice;
      channels[platformKey] = { enabled, price };
    }

    rows.push({
      ...base,
      basePrice: effectivePrice,
      available: effectiveAvailable,
      stock: effectiveStock,
      channels,
    });
  }

  return rows;
}

export function ensureBranchHasDefaultItems(branch: MenuBranch, defaultMenu: DeliveryMenuItem[]) {
  const byId = new Set(branch.items.map((row) => row.itemId));
  const missing = defaultMenu
    .filter((item) => !byId.has(item.id))
    .map((item) => ({ itemId: item.id, included: false } satisfies MenuBranchItem));
  if (!missing.length) return branch;
  return {
    ...branch,
    items: [...branch.items, ...missing],
  };
}
