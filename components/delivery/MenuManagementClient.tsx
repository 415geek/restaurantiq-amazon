'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  Plus,
  RefreshCw,
  Store,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import { MenuBranchManager } from '@/components/menu/MenuBranchManager';
import type {
  DeliveryHolidayHoursEntry,
  DeliveryManagementState,
  DeliveryPromotionDraft,
  DeliveryPlatformKey,
  DeliveryStoreOperationsState,
  DeliveryTimeRange,
  DeliveryWeekday,
} from '@/lib/delivery-management-types';

type Copy = {
  title: string;
  description: string;
  badge: string;
  refresh: string;
  publishMenu: string;
  publishing: string;
  loadFailed: string;
  actionDone: string;
  menuPushed: string;
  noConnectedTitle: string;
  noConnectedBody: string;
  openIntegrationSettings: string;
  searchByName: string;
  allCategories: string;
  allPlatforms: string;
  filterByPlatform: string;
  clearFilters: string;
  showConnectedOnly: string;
  showingItems: string;
  noMenuMatch: string;
  tableDish: string;
  tableCategory: string;
  tableBasePrice: string;
  tableStock: string;
  tableAvailable: string;
  listed: string;
  hidden: string;
  stock: {
    in_stock: string;
    low: string;
    out: string;
  };
  storeOpsTitle: string;
  storeOpsDescription: string;
  storeOpsStore: string;
  storeOpsStatus: string;
  storeOpsOnline: string;
  storeOpsPaused: string;
  storeOpsPrepOffset: string;
  storeOpsDefaultPrep: string;
  storeOpsRegularHours: string;
  storeOpsHolidayHours: string;
  storeOpsPromotions: string;
  storeOpsRefreshLive: string;
  storeOpsSaveLocal: string;
  storeOpsPush: string;
  storeOpsSaving: string;
  storeOpsPushing: string;
  storeOpsAddSlot: string;
  storeOpsAddHoliday: string;
  storeOpsRemove: string;
  storeOpsClosed: string;
  storeOpsPromoName: string;
  storeOpsPromoType: string;
  storeOpsPromoValue: string;
  storeOpsPromoStart: string;
  storeOpsPromoEnd: string;
  storeOpsPromoEnabled: string;
  storeOpsNoStore: string;
  storeOpsNoWarnings: string;
  storeOpsDate: string;
  storeOpsStartTime: string;
  storeOpsEndTime: string;
  storeOpsActions: string;
  storeOpsLastPulled: string;
  storeOpsLastPushed: string;
  storeOpsSyncSource: string;
  storeOpsSyncSourceLocal: string;
  storeOpsSyncSourceLive: string;
  storeOpsAddPromotion: string;
  storeOpsNoHolidayRows: string;
  storeOpsNoPromotionRows: string;
  storeOpsPushReport: string;
  storeOpsWarnings: string;
};

type StoreOpsApiResponse = {
  selectedStoreId: string | null;
  stores: Array<{
    storeId: string;
    storeName: string;
    onlineStatus: 'online' | 'paused';
    syncSource: 'local' | 'live';
    lastPulledAt?: string;
    lastPushedAt?: string;
  }>;
  storeOps: DeliveryStoreOperationsState[];
  updatedAt: string;
};

const WEEKDAY_ORDER: DeliveryWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEKDAY_LABELS: Record<'zh' | 'en', Record<DeliveryWeekday, string>> = {
  zh: {
    monday: '周一',
    tuesday: '周二',
    wednesday: '周三',
    thursday: '周四',
    friday: '周五',
    saturday: '周六',
    sunday: '周日',
  },
  en: {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  },
};

export function MenuManagementClient() {
  const { lang } = useDashboardLanguage();
  const toast = useToast();

  const copy: Copy =
    lang === 'zh'
      ? {
          title: '菜单管理',
          description: '统一管理跨平台菜品上架、渠道价格和库存状态，流程贴近 Deliverect / Otter / StreamOrder 的迁移习惯。',
          badge: 'Menu Ops',
          refresh: '刷新',
          publishMenu: '推送菜单更新',
          publishing: '推送中…',
          loadFailed: '菜单管理数据加载失败',
          actionDone: '操作已更新',
          menuPushed: '菜单已推送到已连接平台',
          noConnectedTitle: '暂未连接外卖平台',
          noConnectedBody: '请先前往 设置中心 → Integrations 完成平台授权后再进行菜单分发。',
          openIntegrationSettings: '去设置中心授权',
          searchByName: '按菜品名称搜索',
          allCategories: '全部分类',
          allPlatforms: '全部平台',
          filterByPlatform: '按平台筛选',
          clearFilters: '清空筛选',
          showConnectedOnly: '仅看已接入平台上架菜品',
          showingItems: '当前展示',
          noMenuMatch: '当前筛选条件下无菜品',
          tableDish: '菜品',
          tableCategory: '分类',
          tableBasePrice: '堂食基准价',
          tableStock: '库存',
          tableAvailable: '上架',
          listed: '已上架',
          hidden: '已下架',
          stock: {
            in_stock: '有货',
            low: '偏低',
            out: '缺货',
          },
          storeOpsTitle: '门店运营配置',
          storeOpsDescription:
            '按 Uber Eats Store Integration 规范统一管理：常规营业时间（service_availability）+ 假期覆盖（holidayhours）+ 在线状态（status）+ 备餐参数（pos_data）+ 促销草稿。',
          storeOpsStore: '门店',
          storeOpsStatus: '在线状态',
          storeOpsOnline: '在线',
          storeOpsPaused: '暂停',
          storeOpsPrepOffset: '备餐时间偏移（分钟）',
          storeOpsDefaultPrep: '默认备餐时间（分钟）',
          storeOpsRegularHours: '常规营业时间（周计划）',
          storeOpsHolidayHours: '假期覆盖时间',
          storeOpsPromotions: '促销草稿（Promotions）',
          storeOpsRefreshLive: '从 Uber 拉取',
          storeOpsSaveLocal: '保存本地配置',
          storeOpsPush: '推送到 Uber',
          storeOpsSaving: '保存中…',
          storeOpsPushing: '推送中…',
          storeOpsAddSlot: '添加时段',
          storeOpsAddHoliday: '添加假期',
          storeOpsRemove: '删除',
          storeOpsClosed: '当天关闭',
          storeOpsPromoName: '活动名称',
          storeOpsPromoType: '活动类型',
          storeOpsPromoValue: '数值',
          storeOpsPromoStart: '开始时间',
          storeOpsPromoEnd: '结束时间',
          storeOpsPromoEnabled: '启用',
          storeOpsNoStore: '当前没有可配置门店。请先完成 Uber 授权并配置 store_id。',
          storeOpsNoWarnings: '当前无告警。',
          storeOpsDate: '日期',
          storeOpsStartTime: '开始',
          storeOpsEndTime: '结束',
          storeOpsActions: '操作',
          storeOpsLastPulled: '最近拉取',
          storeOpsLastPushed: '最近推送',
          storeOpsSyncSource: '同步来源',
          storeOpsSyncSourceLocal: '本地',
          storeOpsSyncSourceLive: '实时',
          storeOpsAddPromotion: '添加促销',
          storeOpsNoHolidayRows: '暂无假期覆盖记录',
          storeOpsNoPromotionRows: '暂无促销草稿',
          storeOpsPushReport: '推送回执',
          storeOpsWarnings: '同步告警',
        }
      : {
          title: 'Menu Management',
          description:
            'Operate channel listings, pricing, and stock status in one menu workspace with migration-friendly patterns from Deliverect / Otter / StreamOrder.',
          badge: 'Menu Ops',
          refresh: 'Refresh',
          publishMenu: 'Publish Menu Updates',
          publishing: 'Publishing…',
          loadFailed: 'Failed to load menu management data',
          actionDone: 'Action updated',
          menuPushed: 'Menu pushed to connected channels',
          noConnectedTitle: 'No delivery platform connected yet',
          noConnectedBody: 'Authorize at least one platform in Settings → Integrations before menu distribution.',
          openIntegrationSettings: 'Open Integrations',
          searchByName: 'Search by item name',
          allCategories: 'All categories',
          allPlatforms: 'All platforms',
          filterByPlatform: 'Filter by platform',
          clearFilters: 'Clear filters',
          showConnectedOnly: 'Only items listed on connected channels',
          showingItems: 'Showing',
          noMenuMatch: 'No menu items under current filters',
          tableDish: 'Dish',
          tableCategory: 'Category',
          tableBasePrice: 'Base price',
          tableStock: 'Stock',
          tableAvailable: 'Listed',
          listed: 'Listed',
          hidden: 'Hidden',
          stock: {
            in_stock: 'In stock',
            low: 'Low',
            out: 'Out',
          },
          storeOpsTitle: 'Store Operations',
          storeOpsDescription:
            'Manage Uber Eats Store Integration settings in one place: weekly service availability + holiday overrides + online status + prep parameters + promotion drafts.',
          storeOpsStore: 'Store',
          storeOpsStatus: 'Online status',
          storeOpsOnline: 'Online',
          storeOpsPaused: 'Paused',
          storeOpsPrepOffset: 'Prep time offset (mins)',
          storeOpsDefaultPrep: 'Default prep time (mins)',
          storeOpsRegularHours: 'Regular hours (weekly)',
          storeOpsHolidayHours: 'Holiday overrides',
          storeOpsPromotions: 'Promotion drafts',
          storeOpsRefreshLive: 'Pull from Uber',
          storeOpsSaveLocal: 'Save locally',
          storeOpsPush: 'Push to Uber',
          storeOpsSaving: 'Saving…',
          storeOpsPushing: 'Pushing…',
          storeOpsAddSlot: 'Add slot',
          storeOpsAddHoliday: 'Add holiday',
          storeOpsRemove: 'Remove',
          storeOpsClosed: 'Closed',
          storeOpsPromoName: 'Promotion name',
          storeOpsPromoType: 'Type',
          storeOpsPromoValue: 'Value',
          storeOpsPromoStart: 'Starts',
          storeOpsPromoEnd: 'Ends',
          storeOpsPromoEnabled: 'Enabled',
          storeOpsNoStore: 'No store available yet. Complete Uber authorization and configure store_id first.',
          storeOpsNoWarnings: 'No warnings.',
          storeOpsDate: 'Date',
          storeOpsStartTime: 'Start',
          storeOpsEndTime: 'End',
          storeOpsActions: 'Actions',
          storeOpsLastPulled: 'Last pulled',
          storeOpsLastPushed: 'Last pushed',
          storeOpsSyncSource: 'Sync source',
          storeOpsSyncSourceLocal: 'Local',
          storeOpsSyncSourceLive: 'Live',
          storeOpsAddPromotion: 'Add promotion',
          storeOpsNoHolidayRows: 'No holiday overrides',
          storeOpsNoPromotionRows: 'No promotion drafts',
          storeOpsPushReport: 'Push report',
          storeOpsWarnings: 'Sync warnings',
        };

  const [state, setState] = useState<DeliveryManagementState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeOpsLoading, setStoreOpsLoading] = useState(false);
  const [storeOpsSaving, setStoreOpsSaving] = useState(false);
  const [storeOpsResponse, setStoreOpsResponse] = useState<StoreOpsApiResponse | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [storeOpsDraft, setStoreOpsDraft] = useState<DeliveryStoreOperationsState | null>(null);
  const [storeOpsPushMessages, setStoreOpsPushMessages] = useState<string[]>([]);

  const loadStoreOps = async (options?: { refresh?: boolean; storeId?: string }) => {
    const params = new URLSearchParams();
    if (options?.refresh) params.set('refresh', 'true');
    if (options?.storeId) params.set('storeId', options.storeId);
    const query = params.toString();
    const res = await fetch(`/api/delivery/store-ops${query ? `?${query}` : ''}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.error || 'store_ops_load_failed');
    }
    const data = (await res.json()) as StoreOpsApiResponse;
    setStoreOpsResponse(data);
    const resolvedStoreId = options?.storeId || data.selectedStoreId || data.stores[0]?.storeId || '';
    setSelectedStoreId(resolvedStoreId);
    const selected = data.storeOps.find((store) => store.storeId === resolvedStoreId);
    setStoreOpsDraft(selected || null);
  };

  const load = async () => {
    setLoading(true);
    setStoreOpsLoading(true);
    try {
      const [managementRes] = await Promise.all([
        fetch('/api/delivery/management', { cache: 'no-store' }),
        loadStoreOps(),
      ]);
      if (!managementRes.ok) throw new Error('delivery_load_failed');
      const data = (await managementRes.json()) as DeliveryManagementState;
      setState(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.startsWith('store_ops')) {
        toast.error(message);
      } else {
        toast.error(copy.loadFailed);
      }
    } finally {
      setLoading(false);
      setStoreOpsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storeOpsResponse || !selectedStoreId) return;
    const selected = storeOpsResponse.storeOps.find((store) => store.storeId === selectedStoreId) || null;
    setStoreOpsDraft(selected);
  }, [storeOpsResponse, selectedStoreId]);

  const patchAction = async (action: Record<string, unknown>, toastMessage?: string) => {
    if (!state) return;
    setSaving(true);
    try {
      const res = await fetch('/api/delivery/management', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'delivery_patch_failed');
      setState(data as DeliveryManagementState);
      if (toastMessage) toast.success(toastMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'delivery_patch_failed');
    } finally {
      setSaving(false);
    }
  };

  const connectedPlatformKeys = useMemo(
    () => new Set((state?.platforms ?? []).filter((platform) => platform.status === 'connected').map((p) => p.key)),
    [state]
  );

  const hasConnectedPlatforms = connectedPlatformKeys.size > 0;

  if (loading || !state) {
    return (
      <div className="space-y-4">
        <PageHeader title={copy.title} description={copy.description} badge={copy.badge} />
        <Card>
          <CardContent className="py-10 text-sm text-zinc-400">{lang === 'zh' ? '加载中…' : 'Loading…'}</CardContent>
        </Card>
      </div>
    );
  }

  const storeRows = storeOpsResponse?.stores || [];
  const activeStoreWarnings = Array.from(
    new Set([...(storeOpsDraft?.syncWarnings || []), ...storeOpsPushMessages].filter(Boolean))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        badge={copy.badge}
        actions={
          <>
            <Button variant="secondary" onClick={() => load()} disabled={loading || saving}>
              <RefreshCw className="h-4 w-4" />
              {copy.refresh}
            </Button>
          </>
        }
      />

      {!hasConnectedPlatforms ? (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-base font-semibold text-zinc-100">{copy.noConnectedTitle}</p>
            <p className="text-sm text-zinc-400">{copy.noConnectedBody}</p>
            <div>
              <Link href="/settings">
                <Button>{copy.openIntegrationSettings}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-4 w-4 text-[#F26A36]" />
                {copy.storeOpsTitle}
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-400">{copy.storeOpsDescription}</p>
            </div>
            {storeOpsDraft ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge className="border-zinc-700 bg-zinc-950/70 text-zinc-300">
                  {copy.storeOpsLastPulled}: {formatTimestamp(storeOpsDraft.lastPulledAt)}
                </Badge>
                <Badge className="border-zinc-700 bg-zinc-950/70 text-zinc-300">
                  {copy.storeOpsLastPushed}: {formatTimestamp(storeOpsDraft.lastPushedAt)}
                </Badge>
                <Badge
                  className={
                    storeOpsDraft.syncSource === 'live'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-950/70 text-zinc-300'
                  }
                >
                  {copy.storeOpsSyncSource}:{' '}
                  {storeOpsDraft.syncSource === 'live'
                    ? copy.storeOpsSyncSourceLive
                    : copy.storeOpsSyncSourceLocal}
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {storeOpsLoading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-8 text-sm text-zinc-400">
              {lang === 'zh' ? '正在加载门店配置…' : 'Loading store operations…'}
            </div>
          ) : !storeRows.length || !storeOpsDraft ? (
            <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
              {copy.storeOpsNoStore}
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
                <label className="space-y-1">
                  <span className="text-xs text-zinc-500">{copy.storeOpsStore}</span>
                  <select
                    value={selectedStoreId}
                    onChange={(event) => setSelectedStoreId(event.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                  >
                    {storeRows.map((store) => (
                      <option key={store.storeId} value={store.storeId}>
                        {store.storeName} ({store.storeId})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-zinc-500">{copy.storeOpsPrepOffset}</span>
                  <input
                    type="number"
                    min={-120}
                    max={120}
                    value={storeOpsDraft.prepTimeOffsetMins}
                    onChange={(event) =>
                      updateDraft({ prepTimeOffsetMins: Number(event.target.value) || 0 })
                    }
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-zinc-500">{copy.storeOpsDefaultPrep}</span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={storeOpsDraft.defaultPrepTimeMins}
                    onChange={(event) =>
                      updateDraft({ defaultPrepTimeMins: Number(event.target.value) || 20 })
                    }
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500">{copy.storeOpsStatus}</div>
                  <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-zinc-700">
                    <button
                      type="button"
                      onClick={() => updateDraft({ onlineStatus: 'online' })}
                      className={`px-3 py-2 text-xs font-medium transition ${
                        storeOpsDraft.onlineStatus === 'online'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {copy.storeOpsOnline}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraft({ onlineStatus: 'paused' })}
                      className={`px-3 py-2 text-xs font-medium transition ${
                        storeOpsDraft.onlineStatus === 'paused'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {copy.storeOpsPaused}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={pullStoreOpsLive}
                  disabled={storeOpsSaving}
                >
                  <RefreshCw className="h-4 w-4" />
                  {copy.storeOpsRefreshLive}
                </Button>
                <Button
                  variant="secondary"
                  onClick={saveStoreOpsLocal}
                  disabled={storeOpsSaving}
                >
                  <CalendarClock className="h-4 w-4" />
                  {storeOpsSaving ? copy.storeOpsSaving : copy.storeOpsSaveLocal}
                </Button>
                <Button onClick={pushStoreOpsLive} disabled={storeOpsSaving}>
                  <UploadCloud className="h-4 w-4" />
                  {storeOpsSaving ? copy.storeOpsPushing : copy.storeOpsPush}
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-100">{copy.storeOpsRegularHours}</p>
                </div>
                <div className="space-y-2">
                  {WEEKDAY_ORDER.map((weekday) => {
                    const slots = storeOpsDraft.regularHours[weekday] || [];
                    return (
                      <div
                        key={`hours-${weekday}`}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium text-zinc-200">
                            {WEEKDAY_LABELS[lang][weekday]}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addWeekdaySlot(weekday)}
                          >
                            <Plus className="h-4 w-4" />
                            {copy.storeOpsAddSlot}
                          </Button>
                        </div>
                        {!slots.length ? (
                          <p className="text-xs text-zinc-500">{copy.storeOpsClosed}</p>
                        ) : (
                          <div className="space-y-2">
                            {slots.map((slot, slotIndex) => (
                              <div
                                key={`slot-${weekday}-${slotIndex}`}
                                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                              >
                                <input
                                  type="time"
                                  value={slot.startTime}
                                  onChange={(event) =>
                                    updateWeekdaySlot(weekday, slotIndex, 'startTime', event.target.value)
                                  }
                                  className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                                />
                                <input
                                  type="time"
                                  value={slot.endTime}
                                  onChange={(event) =>
                                    updateWeekdaySlot(weekday, slotIndex, 'endTime', event.target.value)
                                  }
                                  className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeWeekdaySlot(weekday, slotIndex)}
                                  className="text-red-300 hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {copy.storeOpsRemove}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-100">{copy.storeOpsHolidayHours}</p>
                  <Button size="sm" variant="ghost" onClick={appendHolidayRow}>
                    <Plus className="h-4 w-4" />
                    {copy.storeOpsAddHoliday}
                  </Button>
                </div>
                {!storeOpsDraft.holidayHours.length ? (
                  <p className="text-xs text-zinc-500">{copy.storeOpsNoHolidayRows}</p>
                ) : (
                  <div className="space-y-2">
                    {storeOpsDraft.holidayHours.map((row, rowIndex) => (
                      <div
                        key={row.id}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
                      >
                        <div className="grid gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
                          <label className="space-y-1">
                            <span className="text-[11px] text-zinc-500">{copy.storeOpsDate}</span>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(event) =>
                                updateHolidayRow(rowIndex, { date: event.target.value })
                              }
                              className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] text-zinc-500">{copy.storeOpsStartTime}</span>
                            <input
                              type="time"
                              value={row.startTime || ''}
                              onChange={(event) =>
                                updateHolidayRow(rowIndex, { startTime: event.target.value })
                              }
                              disabled={Boolean(row.closed)}
                              className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70 disabled:opacity-40"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] text-zinc-500">{copy.storeOpsEndTime}</span>
                            <input
                              type="time"
                              value={row.endTime || ''}
                              onChange={(event) =>
                                updateHolidayRow(rowIndex, { endTime: event.target.value })
                              }
                              disabled={Boolean(row.closed)}
                              className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70 disabled:opacity-40"
                            />
                          </label>
                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateHolidayRow(rowIndex, {
                                  closed: !row.closed,
                                  startTime: row.closed ? '11:00' : undefined,
                                  endTime: row.closed ? '21:00' : undefined,
                                })
                              }
                              className={`h-9 rounded-lg border px-3 text-xs ${
                                row.closed
                                  ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                                  : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                              }`}
                            >
                              {copy.storeOpsClosed}
                            </button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeHolidayRow(rowIndex)}
                              className="text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-100">{copy.storeOpsPromotions}</p>
                  <Button size="sm" variant="ghost" onClick={appendPromotionRow}>
                    <Plus className="h-4 w-4" />
                    {copy.storeOpsAddPromotion}
                  </Button>
                </div>
                {!storeOpsDraft.promotions.length ? (
                  <p className="text-xs text-zinc-500">{copy.storeOpsNoPromotionRows}</p>
                ) : (
                  <div className="space-y-2">
                    {storeOpsDraft.promotions.map((promotion, promotionIndex) => (
                      <div
                        key={promotion.id}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
                      >
                        <div className="grid gap-2 lg:grid-cols-[1.4fr_0.9fr_0.8fr_1fr_1fr_auto]">
                          <input
                            type="text"
                            value={promotion.name}
                            onChange={(event) =>
                              updatePromotionRow(promotionIndex, { name: event.target.value })
                            }
                            placeholder={copy.storeOpsPromoName}
                            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                          />
                          <select
                            value={promotion.type}
                            onChange={(event) =>
                              updatePromotionRow(promotionIndex, {
                                type: event.target.value as DeliveryPromotionDraft['type'],
                              })
                            }
                            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                          >
                            <option value="percentage">percentage</option>
                            <option value="fixed_amount">fixed_amount</option>
                            <option value="bogo">bogo</option>
                            <option value="threshold">threshold</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={promotion.value}
                            onChange={(event) =>
                              updatePromotionRow(promotionIndex, {
                                value: Number(event.target.value) || 0,
                              })
                            }
                            placeholder={copy.storeOpsPromoValue}
                            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                          />
                          <input
                            type="datetime-local"
                            value={toDateTimeLocalValue(promotion.startAt)}
                            onChange={(event) =>
                              updatePromotionRow(promotionIndex, {
                                startAt: fromDateTimeLocalValue(event.target.value),
                              })
                            }
                            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                          />
                          <input
                            type="datetime-local"
                            value={toDateTimeLocalValue(promotion.endAt)}
                            onChange={(event) =>
                              updatePromotionRow(promotionIndex, {
                                endAt: fromDateTimeLocalValue(event.target.value),
                              })
                            }
                            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updatePromotionRow(promotionIndex, {
                                  enabled: !promotion.enabled,
                                  syncStatus: 'idle',
                                  lastError: undefined,
                                })
                              }
                              className={`h-9 rounded-lg border px-3 text-xs ${
                                promotion.enabled
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                  : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                              }`}
                            >
                              {copy.storeOpsPromoEnabled}
                            </button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removePromotionRow(promotionIndex)}
                              className="text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge
                            className={
                              promotion.syncStatus === 'synced'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : promotion.syncStatus === 'error'
                                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                  : 'border-zinc-700 bg-zinc-950 text-zinc-300'
                            }
                          >
                            sync: {promotion.syncStatus}
                          </Badge>
                          {promotion.lastError ? (
                            <Badge className="border-red-500/30 bg-red-500/10 text-red-300">
                              {promotion.lastError}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <AlertTriangle className="h-4 w-4 text-yellow-300" />
                    {copy.storeOpsWarnings}
                  </p>
                  {activeStoreWarnings.length ? (
                    <ul className="space-y-1 text-xs text-yellow-200/90">
                      {activeStoreWarnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-500">{copy.storeOpsNoWarnings}</p>
                  )}
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <Clock3 className="h-4 w-4 text-[#F26A36]" />
                    {copy.storeOpsPushReport}
                  </p>
                  {storeOpsPushMessages.length ? (
                    <ul className="space-y-1 text-xs text-zinc-300">
                      {storeOpsPushMessages.map((message) => (
                        <li key={`push-${message}`}>• {message}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-500">{lang === 'zh' ? '暂无推送回执' : 'No push report yet'}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MenuBranchManager state={state} onRefresh={load} />
    </div>
  );
}

function formatTimestamp(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTimeLocalValue(value?: string) {
  if (!value) return '';
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return '';
  return value.length === 16 ? `${value}:00` : value;
}