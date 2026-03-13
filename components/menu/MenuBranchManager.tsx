'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Copy,
  FileUp,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type {
  DeliveryManagementState,
  DeliveryMenuItem,
  DeliveryPlatformKey,
  MenuBranch,
  MenuBranchItem,
  MenuPlatformKey,
} from '@/lib/delivery-management-types';

type Props = {
  state: DeliveryManagementState;
  onRefresh: () => Promise<void>;
};

type CreateMethod = 'pdf' | 'url' | 'copy';

const deliveryPlatforms: DeliveryPlatformKey[] = [
  'ubereats',
  'doordash',
  'grubhub',
  'fantuan',
  'hungrypanda',
];

const platformOptions: Array<{ key: MenuPlatformKey; label: string }> = [
  { key: 'ubereats', label: 'Uber Eats' },
  { key: 'doordash', label: 'DoorDash' },
  { key: 'grubhub', label: 'Grubhub' },
  { key: 'fantuan', label: 'Fantuan' },
  { key: 'hungrypanda', label: 'HungryPanda' },
  { key: 'pos', label: 'POS' },
];

function findBranch(branches: MenuBranch[], menuId: string) {
  return branches.find((b) => b.id === menuId) || null;
}

function effectiveMenuForBranch(defaultMenu: DeliveryMenuItem[], branch: MenuBranch): DeliveryMenuItem[] {
  const baseById = new Map(defaultMenu.map((item) => [item.id, item] as const));
  const platformSet = new Set(branch.platforms);

  const rows: DeliveryMenuItem[] = [];
  for (const entry of branch.items) {
    if (!entry.included) continue;
    const base = baseById.get(entry.itemId);
    if (!base) continue;

    const effectivePrice =
      typeof entry.priceOverride === 'number' && Number.isFinite(entry.priceOverride)
        ? entry.priceOverride
        : base.basePrice;

    const channels: DeliveryMenuItem['channels'] = {};
    for (const key of deliveryPlatforms) {
      const override = entry.channels?.[key];
      const enabled =
        typeof override?.enabled === 'boolean' ? override.enabled : platformSet.has(key);
      const price =
        typeof override?.price === 'number' && Number.isFinite(override.price)
          ? override.price
          : effectivePrice;
      channels[key] = { enabled, price };
    }

    rows.push({
      ...base,
      basePrice: effectivePrice,
      channels,
      available:
        typeof entry.availableOverride === 'boolean' ? entry.availableOverride : base.available,
      stock: entry.stockOverride ?? base.stock,
    });
  }

  return rows;
}

function menuItemMap(branch: MenuBranch | null) {
  if (!branch) return new Map<string, MenuBranchItem>();
  return new Map(branch.items.map((row) => [row.itemId, row] as const));
}

const createSchema = z.object({
  method: z.enum(['pdf', 'url', 'copy']),
  name: z.string().min(1).max(80),
  url: z.string().optional(),
  platforms: z.array(z.enum(['ubereats', 'doordash', 'grubhub', 'fantuan', 'hungrypanda', 'pos'])).min(1),
  fromMenuId: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

export function MenuBranchManager({ state, onRefresh }: Props) {
  const { lang } = useDashboardLanguage();
  const toast = useToast();

  const [branches, setBranches] = useState<MenuBranch[]>(() => state.menuBranches || []);
  const [activeMenuId, setActiveMenuId] = useState<string>('default');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [method, setMethod] = useState<CreateMethod>('pdf');

  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');
  const [menuPlatformFilter, setMenuPlatformFilter] = useState<'all' | DeliveryPlatformKey>('all');

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      method: 'pdf',
      name: '',
      url: '',
      platforms: ['ubereats'],
      fromMenuId: 'default',
    },
  });

  useEffect(() => {
    setBranches(state.menuBranches || []);
  }, [state.menuBranches]);

  const activeBranch = useMemo(
    () => (activeMenuId === 'default' ? null : findBranch(branches, activeMenuId)),
    [activeMenuId, branches]
  );

  const activeBranchMap = useMemo(() => menuItemMap(activeBranch), [activeBranch]);

  const activeMenuItems = useMemo(() => {
    if (activeMenuId === 'default') return state.menu;
    if (!activeBranch) return [];
    return effectiveMenuForBranch(state.menu, activeBranch);
  }, [activeMenuId, activeBranch, state.menu]);

  const categories = useMemo(() => {
    return Array.from(new Set(activeMenuItems.map((item) => item.category)));
  }, [activeMenuItems]);

  const filteredMenu = useMemo(() => {
    const keyword = menuSearch.trim().toLowerCase();
    return activeMenuItems.filter((item) => {
      const matchKeyword = !keyword || item.name.toLowerCase().includes(keyword);
      const matchCategory = menuCategoryFilter === 'all' || item.category === menuCategoryFilter;
      const matchPlatform =
        menuPlatformFilter === 'all' || Boolean(item.channels[menuPlatformFilter]?.enabled);
      return matchKeyword && matchCategory && matchPlatform;
    });
  }, [activeMenuItems, menuSearch, menuCategoryFilter, menuPlatformFilter]);

  const connectedPlatformKeys = useMemo(
    () =>
      new Set(
        (state.platforms ?? [])
          .filter((platform) => platform.status === 'connected')
          .map((p) => p.key)
      ),
    [state.platforms]
  );

  const publishLabel = lang === 'zh' ? '推送菜单到平台' : 'Sync menu to platforms';

  const publish = async () => {
    try {
      const res = await fetch('/api/menu/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId: activeMenuId,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'menu_sync_failed');

      const results = Array.isArray(payload?.results) ? payload.results : [];
      const summary = results
        .map((r: any) => `${r.platform}: ${r.success ? 'OK' : 'FAIL'} (${r.syncedCount || 0})`)
        .join(' | ');

      if (summary) toast.success(summary);
      else toast.success(lang === 'zh' ? '已提交同步' : 'Sync submitted');

      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'menu_sync_failed');
    }
  };

  const createMenu = async (values: CreateFormValues, file?: File | null) => {
    setCreating(true);
    try {
      if (values.method === 'copy') {
        const res = await fetch('/api/menus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            platforms: values.platforms,
            fromMenuId: values.fromMenuId || 'default',
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'menu_create_failed');
        const nextBranches = Array.isArray(payload?.branches) ? (payload.branches as MenuBranch[]) : [];
        setBranches(nextBranches);
        setActiveMenuId(payload?.branch?.id || 'default');
        toast.success(lang === 'zh' ? '菜单已创建' : 'Menu created');
        await onRefresh();
        return;
      }

      const formData = new FormData();
      formData.set('name', values.name);
      formData.set('method', values.method);
      formData.set('platforms', values.platforms.join(','));
      if (values.method === 'url') formData.set('url', values.url || '');
      if (values.method === 'pdf' && file) formData.set('file', file);

      const res = await fetch('/api/menus/import', {
        method: 'POST',
        body: formData,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const warnings = Array.isArray(payload?.warnings) ? payload.warnings.join(' | ') : '';
        throw new Error(`${payload?.error || 'menu_import_failed'}${warnings ? ` (${warnings})` : ''}`);
      }
      const nextBranches = Array.isArray(payload?.branches) ? (payload.branches as MenuBranch[]) : [];
      setBranches(nextBranches);
      setActiveMenuId(payload?.branch?.id || 'default');
      const warnings = Array.isArray(payload?.warnings) ? payload.warnings : [];
      if (warnings.length) toast.warning(warnings.join(' | '));
      toast.success(lang === 'zh' ? '菜单已导入' : 'Menu imported');
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'menu_create_failed');
    } finally {
      setCreating(false);
    }
  };

  const submitCreate = form.handleSubmit(async (values) => {
    const file = (document.getElementById('menu-import-file') as HTMLInputElement | null)?.files?.[0] || null;
    await createMenu(values, file);
    setCreateOpen(false);
    form.reset({
      method: method,
      name: '',
      url: '',
      platforms: ['ubereats'],
      fromMenuId: 'default',
    });
  });

  const updateDefaultBasePrice = async (itemId: string, basePrice: number) => {
    const res = await fetch('/api/delivery/management', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_menu_base_price', itemId, basePrice }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || 'update_failed');
    await onRefresh();
  };

  const updateDefaultChannel = async (
    itemId: string,
    platformKey: DeliveryPlatformKey,
    enabled: boolean,
    price: number
  ) => {
    const res = await fetch('/api/delivery/management', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'update_channel_price',
        itemId,
        platformKey,
        enabled,
        price,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || 'update_failed');
    await onRefresh();
  };

  const updateDefaultAvailable = async (itemId: string, available: boolean) => {
    const res = await fetch('/api/delivery/management', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'toggle_menu_item', itemId, available }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || 'update_failed');
    await onRefresh();
  };

  const patchBranch = async (menuId: string, action: Record<string, unknown>) => {
    const res = await fetch(`/api/menus/${encodeURIComponent(menuId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || 'update_failed');
    const nextBranches = Array.isArray(payload?.branches) ? (payload.branches as MenuBranch[]) : [];
    setBranches(nextBranches);
    await onRefresh();
  };

  const toggleBranchItemIncluded = async (itemId: string, included: boolean) => {
    if (!activeBranch) return;
    await patchBranch(activeBranch.id, { type: 'set_item_included', itemId, included });
  };

  const setBranchItemPrice = async (itemId: string, nextPrice: number | null) => {
    if (!activeBranch) return;
    await patchBranch(activeBranch.id, { type: 'set_item_price_override', itemId, priceOverride: nextPrice });
  };

  const setBranchChannel = async (
    itemId: string,
    platformKey: DeliveryPlatformKey,
    enabled: boolean,
    nextPrice: number | null
  ) => {
    if (!activeBranch) return;
    await patchBranch(activeBranch.id, {
      type: 'set_item_channel',
      itemId,
      platformKey,
      enabled,
      price: nextPrice,
    });
  };

  const deleteActiveBranch = async () => {
    if (!activeBranch) return;
    try {
      await patchBranch(activeBranch.id, { type: 'delete_menu' });
      setActiveMenuId('default');
      toast.success(lang === 'zh' ? '菜单已删除' : 'Menu deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'delete_failed');
    }
  };

  const title = lang === 'zh' ? '菜单管理（多菜单）' : 'Menu Management (multi-menu)';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-xs text-zinc-400">
              {lang === 'zh'
                ? 'Default 菜单是主干；新增菜单为分支，可独立组合与定价。调整 Default 价格会自动影响未覆盖的分支菜品。'
                : 'Default menu is the canonical catalog; new menus are branches with independent composition/pricing. Default price edits propagate unless overridden.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => void onRefresh()}
            >
              <RefreshCw className="h-4 w-4" />
              {lang === 'zh' ? '刷新' : 'Refresh'}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {lang === 'zh' ? '添加新菜单' : 'Add menu'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void publish()}
              disabled={!Array.from(connectedPlatformKeys).length}
            >
              <FileUp className="h-4 w-4" />
              {publishLabel}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_2fr]">
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{lang === 'zh' ? '选择菜单' : 'Select menu'}</span>
            <select
              value={activeMenuId}
              onChange={(e) => setActiveMenuId(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
            >
              <option value="default">Default menu</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-zinc-700 bg-zinc-950/70 text-zinc-300">
                {lang === 'zh' ? '关联平台' : 'Platforms'}:{' '}
                {activeMenuId === 'default'
                  ? Array.from(connectedPlatformKeys).join(', ') || '-'
                  : activeBranch?.platforms.join(', ') || '-'}
              </Badge>
              {activeBranch ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-300 hover:bg-red-500/10"
                  onClick={() => void deleteActiveBranch()}
                >
                  <Trash2 className="h-4 w-4" />
                  {lang === 'zh' ? '删除菜单' : 'Delete'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{lang === 'zh' ? '搜索菜品' : 'Search'}</span>
            <input
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
              placeholder={lang === 'zh' ? '输入菜品名称' : 'Type dish name'}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{lang === 'zh' ? '分类' : 'Category'}</span>
            <select
              value={menuCategoryFilter}
              onChange={(e) => setMenuCategoryFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
            >
              <option value="all">{lang === 'zh' ? '全部' : 'All'}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{lang === 'zh' ? '平台' : 'Platform'}</span>
            <select
              value={menuPlatformFilter}
              onChange={(e) => setMenuPlatformFilter(e.target.value as 'all' | DeliveryPlatformKey)}
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
            >
              <option value="all">{lang === 'zh' ? '全部' : 'All'}</option>
              {deliveryPlatforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60 lg:block">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">{lang === 'zh' ? '菜品' : 'Dish'}</th>
                <th className="px-3 py-2 text-left">{lang === 'zh' ? '分类' : 'Category'}</th>
                <th className="px-3 py-2 text-left">{lang === 'zh' ? '菜单价' : 'Menu price'}</th>
                {deliveryPlatforms.map((platformKey) => (
                  <th key={`head-${platformKey}`} className="px-3 py-2 text-left">
                    {platformKey}
                  </th>
                ))}
                <th className="px-3 py-2 text-left">
                  {activeMenuId === 'default'
                    ? lang === 'zh'
                      ? '上架'
                      : 'Listed'
                    : lang === 'zh'
                      ? '包含'
                      : 'Included'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMenu.map((item) => (
                <tr key={item.id} className="border-t border-zinc-800">
                  <td className="px-3 py-3 font-medium text-zinc-100">{item.name}</td>
                  <td className="px-3 py-3 text-zinc-400">{item.category}</td>
                  <td className="px-3 py-3">
                    <PriceEditor
                      value={item.basePrice}
                      disabled={false}
                      onCommit={async (next) => {
                        try {
                          if (activeMenuId === 'default') {
                            await updateDefaultBasePrice(item.id, next);
                          } else {
                            const defaultBase = state.menu.find((row) => row.id === item.id)?.basePrice;
                            const clear = typeof defaultBase === 'number' && Math.abs(defaultBase - next) < 0.009;
                            await setBranchItemPrice(item.id, clear ? null : next);
                          }
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : 'update_failed');
                        }
                      }}
                    />
                  </td>
                  {deliveryPlatforms.map((platformKey) => (
                    <td key={`${item.id}-${platformKey}`} className="px-3 py-3">
                      <BranchChannelPriceEditor
                        enabled={Boolean(item.channels[platformKey]?.enabled)}
                        price={item.channels[platformKey]?.price ?? item.basePrice}
                        disabled={false}
                        connected={connectedPlatformKeys.has(platformKey)}
                        onSubmit={async (enabled, priceOrNull) => {
                          try {
                            if (activeMenuId === 'default') {
                              await updateDefaultChannel(item.id, platformKey, enabled, priceOrNull ?? item.basePrice);
                            } else {
                              await setBranchChannel(item.id, platformKey, enabled, priceOrNull);
                            }
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : 'update_failed');
                          }
                        }}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    {activeMenuId === 'default' ? (
                      <Button
                        size="sm"
                        variant={item.available ? 'secondary' : 'ghost'}
                        onClick={() => {
                          void (async () => {
                            try {
                              await updateDefaultAvailable(item.id, !item.available);
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'update_failed');
                            }
                          })();
                        }}
                      >
                        {item.available ? (lang === 'zh' ? '已上架' : 'ON') : lang === 'zh' ? '已下架' : 'OFF'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={activeBranchMap.get(item.id)?.included ? 'secondary' : 'ghost'}
                        onClick={() => {
                          void (async () => {
                            try {
                              await toggleBranchItemIncluded(
                                item.id,
                                !Boolean(activeBranchMap.get(item.id)?.included)
                              );
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'update_failed');
                            }
                          })();
                        }}
                      >
                        {activeBranchMap.get(item.id)?.included ? (lang === 'zh' ? '包含' : 'ON') : lang === 'zh' ? '不包含' : 'OFF'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredMenu.length ? (
          <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
            {lang === 'zh' ? '当前筛选条件下无菜品' : 'No items under current filters'}
          </div>
        ) : null}
      </CardContent>

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={lang === 'zh' ? '添加新菜单' : 'Add menu'}
      >
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setMethod('pdf');
                form.setValue('method', 'pdf');
              }}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                method === 'pdf'
                  ? 'border-[#F26A36]/60 bg-[#F26A36]/15 text-zinc-100'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-300'
              }`}
            >
              <FileUp className="h-4 w-4" />
              {lang === 'zh' ? '上传 PDF' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('url');
                form.setValue('method', 'url');
              }}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                method === 'url'
                  ? 'border-[#F26A36]/60 bg-[#F26A36]/15 text-zinc-100'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-300'
              }`}
            >
              <Link2 className="h-4 w-4" />
              {lang === 'zh' ? '菜单网址' : 'URL'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('copy');
                form.setValue('method', 'copy');
              }}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                method === 'copy'
                  ? 'border-[#F26A36]/60 bg-[#F26A36]/15 text-zinc-100'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-300'
              }`}
            >
              <Copy className="h-4 w-4" />
              {lang === 'zh' ? '复制现有菜单' : 'Copy'}
            </button>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs text-zinc-500">{lang === 'zh' ? '菜单名称' : 'Menu name'}</span>
            <input
              {...form.register('name')}
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
              placeholder={lang === 'zh' ? '例如：午市菜单 / 外卖专供菜单' : 'e.g. Lunch menu'}
            />
          </label>

          <div className="space-y-2">
            <p className="text-xs text-zinc-500">{lang === 'zh' ? '关联平台' : 'Platforms'}</p>
            <div className="flex flex-wrap gap-2">
              {platformOptions.map((p) => {
                const selected = form.watch('platforms').includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      const current = form.getValues('platforms');
                      const next = selected
                        ? current.filter((x) => x !== p.key)
                        : [...current, p.key];
                      form.setValue('platforms', next as any, { shouldValidate: true });
                    }}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      selected
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {method === 'pdf' ? (
            <label className="space-y-1 block">
              <span className="text-xs text-zinc-500">{lang === 'zh' ? '上传 PDF' : 'Upload PDF'}</span>
              <input
                id="menu-import-file"
                type="file"
                accept="application/pdf"
                className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:text-zinc-200"
              />
            </label>
          ) : null}

          {method === 'url' ? (
            <label className="space-y-1 block">
              <span className="text-xs text-zinc-500">{lang === 'zh' ? '菜单网址' : 'Menu URL'}</span>
              <input
                {...form.register('url')}
                className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                placeholder="https://..."
              />
              <p className="text-[11px] text-zinc-500">
                {lang === 'zh'
                  ? '系统会抓取网页文本并用大模型提取菜品。'
                  : 'We will fetch the page text and use an LLM to extract dishes.'}
              </p>
            </label>
          ) : null}

          {method === 'copy' ? (
            <label className="space-y-1 block">
              <span className="text-xs text-zinc-500">{lang === 'zh' ? '复制来源' : 'Copy from'}</span>
              <select
                {...form.register('fromMenuId')}
                className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
              >
                <option value="default">Default menu</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              {lang === 'zh' ? '取消' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (lang === 'zh' ? '处理中…' : 'Working…') : lang === 'zh' ? '创建' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function PriceEditor({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (next: number) => void | Promise<void>;
}) {
  const [local, setLocal] = useState(String(value.toFixed(2)));

  useEffect(() => {
    setLocal(String(value.toFixed(2)));
  }, [value]);

  return (
    <input
      type="number"
      min={0}
      step={0.1}
      value={local}
      disabled={disabled}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = Number(local);
        if (Number.isFinite(parsed)) void onCommit(parsed);
      }}
      className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/60"
    />
  );
}

function BranchChannelPriceEditor({
  enabled,
  price,
  disabled,
  connected,
  onSubmit,
}: {
  enabled: boolean;
  price: number;
  disabled: boolean;
  connected: boolean;
  onSubmit: (enabled: boolean, price: number | null) => void | Promise<void>;
}) {
  const [localEnabled, setLocalEnabled] = useState(() => enabled);
  const [localPrice, setLocalPrice] = useState(() => String(price.toFixed(2)));

  useEffect(() => {
    setLocalEnabled(enabled);
    setLocalPrice(String(price.toFixed(2)));
  }, [enabled, price]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          const next = !localEnabled;
          setLocalEnabled(next);
          const parsed = Number(localPrice);
          void onSubmit(next, Number.isFinite(parsed) ? parsed : null);
        }}
        className={`h-8 rounded-lg border px-2 text-xs ${
          localEnabled
            ? connected
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-zinc-600 bg-zinc-900 text-zinc-300'
            : 'border-zinc-700 bg-zinc-900/60 text-zinc-400'
        }`}
        disabled={disabled}
      >
        {localEnabled ? 'ON' : 'OFF'}
      </button>
      <input
        type="number"
        min={0}
        step={0.1}
        value={localPrice}
        onChange={(e) => setLocalPrice(e.target.value)}
        onBlur={() => {
          const parsed = Number(localPrice);
          void onSubmit(localEnabled, Number.isFinite(parsed) ? parsed : null);
        }}
        disabled={disabled}
        className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/60"
      />
    </div>
  );
}
