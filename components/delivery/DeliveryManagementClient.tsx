'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BellRing,
  CalendarRange,
  CheckCircle2,
  Filter,
  Layers,
  PackageCheck,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  ShoppingBag,
  Truck,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type {
  DeliveryAutomationConfig,
  DeliveryManagementState,
  DeliveryOrderDetailResponse,
  DeliveryOrderQueryRow,
  DeliveryOrderStatus,
  DeliveryOrderTicket,
  DeliveryPlatformConnection,
  DeliveryPlatformKey,
} from '@/lib/delivery-management-types';

type WorkspaceView = 'orders' | 'menu' | 'query' | 'automation' | 'webhooks';

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
  saved: string;
  connectCenterTitle: string;
  connectCenterDescription: string;
  authorizeConnect: string;
  disconnectLink: string;
  connectedState: string;
  unconnectedState: string;
  connectFirstTitle: string;
  connectFirstBody: string;
  workspaceTitle: string;
  workspaceDescription: string;
  nav: Record<WorkspaceView, string>;
  kpiAcceptance: string;
  kpiCancellation: string;
  kpiAov: string;
  kpiChannels: string;
  platformStatus: {
    connected: string;
    not_connected: string;
    issue: string;
  };
  stock: {
    in_stock: string;
    low: string;
    out: string;
  };
  orderStatus: Record<DeliveryOrderStatus, string>;
  allPlatforms: string;
  allCategories: string;
  filterByPlatform: string;
  searchByName: string;
  showConnectedOnly: string;
  clearFilters: string;
  showingItems: string;
  noMenuMatch: string;
  tableDish: string;
  tableCategory: string;
  tableBasePrice: string;
  tableStock: string;
  tableAvailable: string;
  listed: string;
  hidden: string;
  queue: string;
  prep: string;
  noSync: string;
  syncedAt: string;
  orderBoardTitle: string;
  orderBoardSubtitle: string;
  orderBoardEmpty: string;
  orderBoardSelectOrder: string;
  orderBoardReceipt: string;
  customer: string;
  items: string;
  amount: string;
  eta: string;
  placedAt: string;
  notes: string;
  accept: string;
  startPrep: string;
  markReady: string;
  complete: string;
  cancel: string;
  orderQueryCenter: string;
  orderQueryDescription: string;
  filterDateFrom: string;
  filterDateTo: string;
  filterCustomer: string;
  filterKeyword: string;
  searchOrders: string;
  resetFilters: string;
  noQueryOrders: string;
  loadingOrders: string;
  detailTitle: string;
  detailHint: string;
  detailSourceApi: string;
  detailSourceFallback: string;
  warningPrefix: string;
  viewDetails: string;
  queryTableOrderId: string;
  queryTablePlatform: string;
  queryTableCustomer: string;
  queryTableAmount: string;
  queryTableStatus: string;
  queryTablePlacedAt: string;
  automation: string;
  webhooks: string;
  noWebhookHint: string;
  autoAccept: string;
  autoAcceptCap: string;
  pauseQueue: string;
  prepBuffer: string;
  weekendMarkup: string;
  saveAutomation: string;
  eventTime: string;
  eventTopic: string;
  eventStore: string;
  eventType: string;
  sourceLabel: string;
  commandCenterTitle: string;
  commandCenterDescription: string;
  workspaceShortcuts: string;
  globalActions: string;
  runSyncNow: string;
  fulfillmentPad: string;
  intakeControls: string;
  selectedOrderLabel: string;
  noConnectedChannels: string;
};

const ORDER_COLUMNS: DeliveryOrderStatus[] = [
  'new',
  'accepted',
  'preparing',
  'ready',
  'completed',
];

const DEFAULT_ORDER_QUERY_FILTERS: {
  platform: 'all' | DeliveryPlatformKey;
  dateFrom: string;
  dateTo: string;
  customer: string;
  q: string;
} = {
  platform: 'all',
  dateFrom: '',
  dateTo: '',
  customer: '',
  q: '',
};

const DEFAULT_WORKSPACE_VIEW: WorkspaceView = 'orders';

const WORKSPACE_VIEW_ORDER: WorkspaceView[] = ['orders', 'menu', 'query', 'automation', 'webhooks'];

export function DeliveryManagementClient() {
  const { lang } = useDashboardLanguage();
  const toast = useToast();

  const copy: Copy =
    lang === 'zh'
      ? {
          title: '外卖管理',
          description:
            '接入后进入统一外卖运营中台，覆盖菜单、订单、查询、自动化与实时事件流。',
          badge: 'Delivery Ops',
          refresh: '刷新',
          publishMenu: '推送菜单更新',
          publishing: '推送中…',
          loadFailed: '外卖管理数据加载失败',
          actionDone: '操作已更新',
          menuPushed: '菜单已推送到已连接平台',
          saved: '已保存',
          connectCenterTitle: '选择接入平台',
          connectCenterDescription:
            '首次进入仅显示接入卡片。完成至少一个平台授权后，自动进入运营工作台。',
          authorizeConnect: '授权接入',
          disconnectLink: '取消链接',
          connectedState: '已接入',
          unconnectedState: '未连接',
          connectFirstTitle: '先完成至少一个平台接入',
          connectFirstBody: '接入成功后，这里会自动展示菜单、订单、查询与自动化管理。',
          workspaceTitle: '外卖运营工作台',
          workspaceDescription:
            '操作逻辑按 Deliverect / Otter / StreamOrder 的高频路径设计，降低迁移学习成本。',
          nav: {
            orders: '订单中台',
            menu: '菜单中台',
            query: '订单查询',
            automation: '自动化策略',
            webhooks: '事件流',
          },
          kpiAcceptance: '接单率',
          kpiCancellation: '取消率',
          kpiAov: '平均订单金额',
          kpiChannels: '已连接平台',
          platformStatus: {
            connected: '已连接',
            not_connected: '未连接',
            issue: '异常',
          },
          stock: {
            in_stock: '有货',
            low: '偏低',
            out: '缺货',
          },
          orderStatus: {
            new: '新单',
            accepted: '已接单',
            preparing: '制作中',
            ready: '待取餐',
            completed: '已完成',
            cancelled: '已取消',
          },
          allPlatforms: '全部平台',
          allCategories: '全部分类',
          filterByPlatform: '按平台筛选',
          searchByName: '按菜品名称搜索',
          showConnectedOnly: '仅看已接入平台上架菜品',
          clearFilters: '清空筛选',
          showingItems: '当前展示',
          noMenuMatch: '当前筛选条件下无菜品',
          tableDish: '菜品',
          tableCategory: '分类',
          tableBasePrice: '堂食基准价',
          tableStock: '库存',
          tableAvailable: '上架',
          listed: '已上架',
          hidden: '已下架',
          queue: '队列',
          prep: '平均出餐',
          noSync: '未同步',
          syncedAt: '菜单同步',
          orderBoardTitle: '订单处理台',
          orderBoardSubtitle: '按状态看板处理订单，点击订单查看详情并推进履约。',
          orderBoardEmpty: '当前筛选下暂无订单',
          orderBoardSelectOrder: '请先选择一笔订单',
          orderBoardReceipt: '订单明细',
          customer: '顾客',
          items: '菜品',
          amount: '金额',
          eta: 'ETA',
          placedAt: '下单时间',
          notes: '备注',
          accept: '接单',
          startPrep: '开始制作',
          markReady: '标记待取',
          complete: '完成',
          cancel: '取消',
          orderQueryCenter: '订单查询',
          orderQueryDescription: '按平台、日期、顾客、关键词筛选订单，点击查看平台原始字段。',
          filterDateFrom: '开始日期',
          filterDateTo: '结束日期',
          filterCustomer: '顾客姓名',
          filterKeyword: '关键词',
          searchOrders: '查询订单',
          resetFilters: '重置筛选',
          noQueryOrders: '没有匹配到订单',
          loadingOrders: '订单查询中…',
          detailTitle: '订单详情（平台原始字段）',
          detailHint: '点击左侧订单查看详情',
          detailSourceApi: '来自平台 API',
          detailSourceFallback: '来自本地回退数据',
          warningPrefix: '提示',
          viewDetails: '查看详情',
          queryTableOrderId: '订单号',
          queryTablePlatform: '平台',
          queryTableCustomer: '顾客',
          queryTableAmount: '金额',
          queryTableStatus: '状态',
          queryTablePlacedAt: '下单时间',
          automation: '自动化策略',
          webhooks: '实时推送事件（Webhook）',
          noWebhookHint:
            '暂未收到事件。请在 Uber Developer Dashboard 将 Webhook URL 指向 /api/webhooks/ubereats。',
          autoAccept: '低风险自动接单',
          autoAcceptCap: '自动接单金额上限',
          pauseQueue: '队列阈值自动暂停',
          prepBuffer: '备餐缓冲分钟',
          weekendMarkup: '周末加价 (%)',
          saveAutomation: '保存策略',
          eventTime: '接收时间',
          eventTopic: '主题',
          eventStore: '门店',
          eventType: '事件',
          sourceLabel: '数据源',
          commandCenterTitle: '统一操作台',
          commandCenterDescription:
            '将高频动作集中在一个区域：工作区切换、全局操作、订单履约、平台接单控制。',
          workspaceShortcuts: '工作区快捷入口',
          globalActions: '全局操作',
          runSyncNow: '立即同步',
          fulfillmentPad: '履约动作面板',
          intakeControls: '平台接单开关',
          selectedOrderLabel: '当前选中订单',
          noConnectedChannels: '暂无已接入平台',
        }
      : {
          title: 'Delivery Management',
          description:
            'After channel authorization, operate menus, orders, search, automation, and event streams in one console.',
          badge: 'Delivery Ops',
          refresh: 'Refresh',
          publishMenu: 'Publish Menu Updates',
          publishing: 'Publishing…',
          loadFailed: 'Failed to load delivery management data',
          actionDone: 'Action updated',
          menuPushed: 'Menu pushed to connected channels',
          saved: 'Saved',
          connectCenterTitle: 'Choose integration channels',
          connectCenterDescription:
            'First-time users only see connection cards. The workspace unlocks after at least one platform is connected.',
          authorizeConnect: 'Authorize',
          disconnectLink: 'Disconnect',
          connectedState: 'Connected',
          unconnectedState: 'Not connected',
          connectFirstTitle: 'Connect at least one platform first',
          connectFirstBody: 'Once connected, menu, order, query, and automation operations unlock automatically.',
          workspaceTitle: 'Delivery Operations Workspace',
          workspaceDescription:
            'Interaction flow mirrors high-frequency patterns from Deliverect / Otter / StreamOrder.',
          nav: {
            orders: 'Orders',
            menu: 'Menus',
            query: 'Order Query',
            automation: 'Automation',
            webhooks: 'Event Stream',
          },
          kpiAcceptance: 'Acceptance Rate',
          kpiCancellation: 'Cancellation Rate',
          kpiAov: 'Avg Order Value',
          kpiChannels: 'Connected Channels',
          platformStatus: {
            connected: 'Connected',
            not_connected: 'Not connected',
            issue: 'Issue',
          },
          stock: {
            in_stock: 'In stock',
            low: 'Low',
            out: 'Out',
          },
          orderStatus: {
            new: 'New',
            accepted: 'Accepted',
            preparing: 'Preparing',
            ready: 'Ready',
            completed: 'Completed',
            cancelled: 'Cancelled',
          },
          allPlatforms: 'All platforms',
          allCategories: 'All categories',
          filterByPlatform: 'Filter by platform',
          searchByName: 'Search by item name',
          showConnectedOnly: 'Only items listed on connected channels',
          clearFilters: 'Clear filters',
          showingItems: 'Showing',
          noMenuMatch: 'No menu items under current filters',
          tableDish: 'Dish',
          tableCategory: 'Category',
          tableBasePrice: 'Base Price',
          tableStock: 'Stock',
          tableAvailable: 'Listed',
          listed: 'Listed',
          hidden: 'Hidden',
          queue: 'Queue',
          prep: 'Avg prep',
          noSync: 'Not synced',
          syncedAt: 'Menu sync',
          orderBoardTitle: 'Order Operations Board',
          orderBoardSubtitle: 'Process orders by status lanes. Select one order to inspect and advance fulfillment.',
          orderBoardEmpty: 'No orders under current filters',
          orderBoardSelectOrder: 'Select one order first',
          orderBoardReceipt: 'Order detail',
          customer: 'Customer',
          items: 'Items',
          amount: 'Amount',
          eta: 'ETA',
          placedAt: 'Placed At',
          notes: 'Notes',
          accept: 'Accept',
          startPrep: 'Start Prep',
          markReady: 'Mark Ready',
          complete: 'Complete',
          cancel: 'Cancel',
          orderQueryCenter: 'Order Query',
          orderQueryDescription: 'Filter by platform, date, customer, or keyword. Click to inspect raw platform fields.',
          filterDateFrom: 'Date from',
          filterDateTo: 'Date to',
          filterCustomer: 'Customer name',
          filterKeyword: 'Keyword',
          searchOrders: 'Search orders',
          resetFilters: 'Reset filters',
          noQueryOrders: 'No orders matched',
          loadingOrders: 'Loading orders…',
          detailTitle: 'Order detail (raw platform fields)',
          detailHint: 'Select an order from the list to inspect details',
          detailSourceApi: 'Source: delivery API',
          detailSourceFallback: 'Source: local fallback data',
          warningPrefix: 'Warning',
          viewDetails: 'View details',
          queryTableOrderId: 'Order ID',
          queryTablePlatform: 'Platform',
          queryTableCustomer: 'Customer',
          queryTableAmount: 'Amount',
          queryTableStatus: 'Status',
          queryTablePlacedAt: 'Placed At',
          automation: 'Automation Policy',
          webhooks: 'Realtime Push Events (Webhook)',
          noWebhookHint: 'No events yet. Point Uber Webhook URL to /api/webhooks/ubereats in Uber Developer Dashboard.',
          autoAccept: 'Auto-accept low-risk orders',
          autoAcceptCap: 'Auto-accept amount cap',
          pauseQueue: 'Pause threshold (queue)',
          prepBuffer: 'Prep buffer (mins)',
          weekendMarkup: 'Weekend markup (%)',
          saveAutomation: 'Save policy',
          eventTime: 'Received',
          eventTopic: 'Topic',
          eventStore: 'Store',
          eventType: 'Event',
          sourceLabel: 'Source',
          commandCenterTitle: 'Command Center',
          commandCenterDescription:
            'Expose high-frequency controls in one place: workspace switch, global actions, fulfillment actions, and intake toggles.',
          workspaceShortcuts: 'Workspace Shortcuts',
          globalActions: 'Global Actions',
          runSyncNow: 'Sync Now',
          fulfillmentPad: 'Fulfillment Action Pad',
          intakeControls: 'Channel Intake Controls',
          selectedOrderLabel: 'Selected order',
          noConnectedChannels: 'No connected channels',
        };

  const [state, setState] = useState<DeliveryManagementState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(DEFAULT_WORKSPACE_VIEW);

  const [orderBoardStatus, setOrderBoardStatus] = useState<DeliveryOrderStatus | 'all'>('all');
  const [orderBoardPlatform, setOrderBoardPlatform] = useState<'all' | DeliveryPlatformKey>('all');
  const [orderBoardSearch, setOrderBoardSearch] = useState('');
  const [selectedBoardOrderId, setSelectedBoardOrderId] = useState<string | null>(null);

  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');
  const [menuPlatformFilter, setMenuPlatformFilter] = useState<'all' | DeliveryPlatformKey>('all');
  const [menuConnectedOnly, setMenuConnectedOnly] = useState(false);

  const [queryLoading, setQueryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [queryRows, setQueryRows] = useState<DeliveryOrderQueryRow[]>([]);
  const [queryWarning, setQueryWarning] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<DeliveryOrderDetailResponse | null>(null);
  const [queryFilters, setQueryFilters] = useState<{
    platform: 'all' | DeliveryPlatformKey;
    dateFrom: string;
    dateTo: string;
    customer: string;
    q: string;
  }>(DEFAULT_ORDER_QUERY_FILTERS);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/management', { cache: 'no-store' });
      if (!res.ok) throw new Error('delivery_load_failed');
      const data = (await res.json()) as DeliveryManagementState;
      setState(data);
    } catch {
      toast.error(copy.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  const refreshLiveData = async () => {
    try {
      const res = await fetch('/api/delivery/management', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as DeliveryManagementState;
      setState(data);
    } catch {
      // Keep silent on background refresh; manual refresh button still shows toasts.
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state) return;
    void searchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.updatedAt]);

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

  const buildOrderQueryParams = (filters: typeof queryFilters = queryFilters) => {
    const params = new URLSearchParams();
    if (filters.platform !== 'all') params.set('platform', filters.platform);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.customer.trim()) params.set('customer', filters.customer.trim());
    if (filters.q.trim()) params.set('q', filters.q.trim());
    return params;
  };

  const searchOrders = async (filters: typeof queryFilters = queryFilters) => {
    setQueryLoading(true);
    setQueryWarning(null);
    try {
      const params = buildOrderQueryParams(filters);
      const res = await fetch(`/api/delivery/orders?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'delivery_order_query_failed');
      const orders = (data?.orders ?? []) as DeliveryOrderQueryRow[];
      setQueryRows(orders);
      setQueryWarning(typeof data?.warning === 'string' ? data.warning : null);
      if (selectedOrderDetail) {
        const stillExists = orders.some((row) => row.id === selectedOrderDetail.order.id);
        if (!stillExists) setSelectedOrderDetail(null);
      }
    } catch (error) {
      setQueryRows([]);
      setSelectedOrderDetail(null);
      toast.error(error instanceof Error ? error.message : 'delivery_order_query_failed');
    } finally {
      setQueryLoading(false);
    }
  };

  const loadOrderDetail = async (order: DeliveryOrderQueryRow) => {
    setDetailLoading(true);
    try {
      const params = buildOrderQueryParams();
      params.set('platform', order.platform);
      const res = await fetch(`/api/delivery/orders/${encodeURIComponent(order.id)}?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'delivery_order_detail_failed');
      setSelectedOrderDetail(data as DeliveryOrderDetailResponse);
      if (typeof data?.warning === 'string') {
        setQueryWarning(data.warning);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'delivery_order_detail_failed');
    } finally {
      setDetailLoading(false);
    }
  };

  const resetOrderFilters = async () => {
    setQueryFilters(DEFAULT_ORDER_QUERY_FILTERS);
    setSelectedOrderDetail(null);
    await searchOrders(DEFAULT_ORDER_QUERY_FILTERS);
  };

  const platformByKey = useMemo(() => {
    const map = new Map<DeliveryPlatformKey, DeliveryPlatformConnection>();
    if (!state) return map;
    for (const platform of state.platforms) map.set(platform.key, platform);
    return map;
  }, [state]);

  const onboardingByKey = useMemo(() => {
    const map = new Map<DeliveryPlatformKey, DeliveryManagementState['onboarding']['platformStates'][number]>();
    if (!state) return map;
    for (const platform of state.onboarding.platformStates) map.set(platform.key, platform);
    return map;
  }, [state]);

  const isPlatformConnected = (platformKey: DeliveryPlatformKey) => {
    const onboardingStatus = onboardingByKey.get(platformKey)?.authStatus;
    const platformStatus = platformByKey.get(platformKey)?.status;
    return onboardingStatus === 'connected' || platformStatus === 'connected';
  };

  const connectedPlatforms = useMemo(
    () => (state ? state.platforms.filter((platform) => isPlatformConnected(platform.key)) : []),
    [state, platformByKey, onboardingByKey]
  );

  const hasConnectedPlatforms = connectedPlatforms.length > 0;

  useEffect(() => {
    if (!hasConnectedPlatforms) {
      setWorkspaceView(DEFAULT_WORKSPACE_VIEW);
    }
  }, [hasConnectedPlatforms]);

  useEffect(() => {
    if (!hasConnectedPlatforms) return;
    const interval = window.setInterval(() => {
      if (document.hidden || saving) return;
      void refreshLiveData();
      void searchOrders();
    }, 10000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConnectedPlatforms, saving, queryFilters]);

  const categories = useMemo(() => {
    if (!state) return [];
    return Array.from(new Set(state.menu.map((item) => item.category)));
  }, [state]);

  const filteredMenu = useMemo(() => {
    if (!state) return [];
    const keyword = menuSearch.trim().toLowerCase();
    const connectedKeys = new Set(connectedPlatforms.map((platform) => platform.key));
    return state.menu.filter((item) => {
      const matchKeyword = !keyword || item.name.toLowerCase().includes(keyword);
      const matchCategory = menuCategoryFilter === 'all' || item.category === menuCategoryFilter;
      const matchPlatform =
        menuPlatformFilter === 'all' || Boolean(item.channels[menuPlatformFilter]?.enabled);
      const matchConnectedOnly = !menuConnectedOnly
        ? true
        : Object.entries(item.channels).some(
            ([platformKey, config]) =>
              connectedKeys.has(platformKey as DeliveryPlatformKey) && Boolean(config?.enabled)
          );
      return matchKeyword && matchCategory && matchPlatform && matchConnectedOnly;
    });
  }, [state, menuSearch, menuCategoryFilter, menuPlatformFilter, menuConnectedOnly, connectedPlatforms]);

  const orderBoardOrders = useMemo(() => {
    if (!state) return [];
    const keyword = orderBoardSearch.trim().toLowerCase();
    return state.orders
      .filter((order) => {
        const matchStatus = orderBoardStatus === 'all' || order.status === orderBoardStatus;
        const matchPlatform = orderBoardPlatform === 'all' || order.platform === orderBoardPlatform;
        const blob = `${order.channelOrderId} ${order.customerName} ${order.items.join(' ')}`.toLowerCase();
        const matchKeyword = !keyword || blob.includes(keyword);
        return matchStatus && matchPlatform && matchKeyword;
      })
      .sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt));
  }, [state, orderBoardStatus, orderBoardPlatform, orderBoardSearch]);

  useEffect(() => {
    if (!orderBoardOrders.length) {
      setSelectedBoardOrderId(null);
      return;
    }
    if (!selectedBoardOrderId || !orderBoardOrders.some((order) => order.id === selectedBoardOrderId)) {
      setSelectedBoardOrderId(orderBoardOrders[0].id);
    }
  }, [orderBoardOrders, selectedBoardOrderId]);

  const selectedBoardOrder = orderBoardOrders.find((order) => order.id === selectedBoardOrderId) ?? null;

  const operationalKpis = useMemo(() => {
    if (!state) {
      return {
        acceptanceRate: 0,
        cancellationRate: 0,
        avgOrderValue: 0,
        connectedChannels: 0,
      };
    }
    const total = state.orders.length || 1;
    const completedOrInFlight = state.orders.filter((order) =>
      ['accepted', 'preparing', 'ready', 'completed'].includes(order.status)
    ).length;
    const cancelled = state.orders.filter((order) => order.status === 'cancelled').length;
    const gross = state.orders.reduce((sum, order) => sum + order.amount, 0);
    const connectedChannels = state.platforms.filter((platform) => isPlatformConnected(platform.key)).length;
    return {
      acceptanceRate: Math.round((completedOrInFlight / total) * 100),
      cancellationRate: Math.round((cancelled / total) * 100),
      avgOrderValue: gross / total,
      connectedChannels,
    };
  }, [state, platformByKey, onboardingByKey]);

  const authorizePlatform = async (platformKey: DeliveryPlatformKey) => {
    if (!state) return;
    const selected = Array.from(new Set([...state.onboarding.selectedPlatforms, platformKey]));
    await patchAction({ type: 'set_selected_platforms', platformKeys: selected });

    if (platformKey === 'ubereats') {
      await patchAction({ type: 'set_platform_auth_status', platformKey, status: 'pending' });
      window.location.href = '/api/integrations/ubereats/start';
      return;
    }

    await patchAction({ type: 'set_platform_auth_status', platformKey, status: 'connected' });
    await patchAction({ type: 'run_initial_sync' }, copy.actionDone);
  };

  const disconnectPlatform = async (platformKey: DeliveryPlatformKey) => {
    await patchAction({ type: 'disconnect_platform', platformKey }, copy.actionDone);
  };

  const updateOrder = async (orderId: string, status: DeliveryOrderStatus) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/delivery/orders/${encodeURIComponent(orderId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'delivery_order_action_failed'
        );
      }
      await refreshLiveData();
      await searchOrders();
      toast.success(copy.actionDone);
      if (typeof data?.warning === 'string' && data.warning.trim()) {
        toast.warning(data.warning);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'delivery_order_action_failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = async (platform: DeliveryPlatformConnection, acceptsOrders: boolean) => {
    await patchAction(
      { type: 'toggle_platform_acceptance', platformKey: platform.key, acceptsOrders },
      copy.actionDone
    );
  };

  const toggleItemListing = async (itemId: string, available: boolean) => {
    await patchAction({ type: 'toggle_menu_item', itemId, available }, copy.actionDone);
  };

  const updateChannelPrice = async (
    itemId: string,
    platformKey: DeliveryPlatformKey,
    enabled: boolean,
    price: number
  ) => {
    await patchAction(
      {
        type: 'update_channel_price',
        itemId,
        platformKey,
        enabled,
        price,
      },
      copy.actionDone
    );
  };

  const saveAutomation = async (automation: DeliveryAutomationConfig) => {
    await patchAction({ type: 'save_automation', automation }, copy.saved);
  };

  const publishMenu = async () => {
    await patchAction({ type: 'publish_menu' }, copy.menuPushed);
  };

  const runInitialSyncNow = async () => {
    await patchAction({ type: 'run_initial_sync' }, copy.actionDone);
  };

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

  const renderOrdersWorkspace = () => {
    const inProgressCount = state.orders.filter((order) =>
      ['accepted', 'preparing'].includes(order.status)
    ).length;
    const readyCount = state.orders.filter((order) => order.status === 'ready').length;
    const deliveryCount = state.orders.filter((order) =>
      ['ready', 'completed'].includes(order.status)
    ).length;
    const avgPrep =
      state.orders.reduce((sum, order) => sum + order.etaMins, 0) / Math.max(state.orders.length, 1);
    const platformLabel = (platformKey: DeliveryPlatformKey) =>
      state.platforms.find((platform) => platform.key === platformKey)?.label ?? platformKey;

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <OrderMetricCard
                label={lang === 'zh' ? '全部订单' : 'All Active'}
                value={String(state.orders.length)}
              />
              <OrderMetricCard
                label={lang === 'zh' ? '处理中' : 'In progress'}
                value={String(inProgressCount)}
              />
              <OrderMetricCard
                label={lang === 'zh' ? '待取餐' : 'Ready to pick-up'}
                value={String(readyCount)}
              />
              <OrderMetricCard
                label={lang === 'zh' ? '履约中/已完成' : 'For delivery'}
                value={String(deliveryCount)}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-[180px_1fr_150px]">
              <label className="space-y-1">
                <span className="text-xs text-zinc-500">{copy.filterByPlatform}</span>
                <select
                  value={orderBoardPlatform}
                  onChange={(event) => setOrderBoardPlatform(event.target.value as 'all' | DeliveryPlatformKey)}
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                >
                  <option value="all">{copy.allPlatforms}</option>
                  {state.platforms.map((platform) => (
                    <option key={platform.key} value={platform.key}>
                      {platform.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-zinc-500">{copy.filterKeyword}</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={orderBoardSearch}
                    onChange={(event) => setOrderBoardSearch(event.target.value)}
                    placeholder={lang === 'zh' ? '订单号 / 顾客 / 菜品关键词' : 'Order ID / customer / item keyword'}
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                  />
                </div>
              </label>
              <div className="flex items-end">
                <div className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-xs text-zinc-400">
                  <div className="flex h-full items-center justify-between">
                    <span>{lang === 'zh' ? '平均 ETA' : 'Avg ETA'}</span>
                    <span className="font-semibold text-zinc-100">{Math.round(avgPrep)}m</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 xl:grid-cols-6">
              <FilterPill
                active={orderBoardStatus === 'all'}
                onClick={() => setOrderBoardStatus('all')}
                label={lang === 'zh' ? '全部状态' : 'All statuses'}
                count={state.orders.length}
              />
              {ORDER_COLUMNS.map((status) => (
                <FilterPill
                  key={status}
                  active={orderBoardStatus === status}
                  onClick={() => setOrderBoardStatus(status)}
                  label={copy.orderStatus[status]}
                  count={state.orders.filter((order) => order.status === status).length}
                />
              ))}
            </div>

            <div className="space-y-4 xl:hidden">
              <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{copy.orderBoardTitle}</p>
                  <Badge>{orderBoardOrders.length}</Badge>
                </div>
                {orderBoardOrders.length ? (
                  orderBoardOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedBoardOrderId(order.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                        order.id === selectedBoardOrderId
                          ? 'border-[#F26A36]/40 bg-[#F26A36]/10'
                          : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{order.customerName}</p>
                          <p className="mt-1 text-xs text-zinc-400">{order.channelOrderId}</p>
                        </div>
                        <Badge className="border-zinc-700 bg-zinc-900/70 text-zinc-300">
                          {copy.orderStatus[order.status]}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                        <span>{platformLabel(order.platform)}</span>
                        <span className="text-right">${order.amount.toFixed(2)}</span>
                        <span>{new Date(order.placedAt).toLocaleTimeString()}</span>
                        <span className="text-right">{order.etaMins}m</span>
                      </div>
                      {order.id === selectedBoardOrderId ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <OrderActionButtons order={order} onUpdate={updateOrder} copy={copy} />
                        </div>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-5 text-center text-xs text-zinc-500">
                    {copy.orderBoardEmpty}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                {!selectedBoardOrder ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500">
                    {copy.orderBoardSelectOrder}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <InfoRow label={copy.queryTableOrderId} value={selectedBoardOrder.channelOrderId} />
                    <InfoRow label={copy.queryTablePlatform} value={platformLabel(selectedBoardOrder.platform)} />
                    <InfoRow label={copy.customer} value={selectedBoardOrder.customerName} />
                    <InfoRow label={copy.amount} value={`$${selectedBoardOrder.amount.toFixed(2)}`} />
                    <InfoRow label={copy.eta} value={`${selectedBoardOrder.etaMins}m`} />
                    <InfoRow label={copy.placedAt} value={new Date(selectedBoardOrder.placedAt).toLocaleString()} />
                    <InfoRow label={copy.notes} value={selectedBoardOrder.notes || '-'} />
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <p className="mb-2 text-sm font-semibold text-zinc-100">{copy.orderBoardReceipt}</p>
                      <ul className="space-y-1 text-xs text-zinc-300">
                        {selectedBoardOrder.items.map((item, index) => (
                          <li key={`${item}-${index}`} className="flex items-center justify-between gap-2">
                            <span>{item}</span>
                            <span className="text-zinc-500">x1</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden gap-4 xl:grid xl:grid-cols-[0.78fr_0.9fr_1.2fr]">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{copy.orderBoardTitle}</p>
                  <Badge>{orderBoardOrders.length}</Badge>
                </div>
                <div className="space-y-2">
                  {orderBoardOrders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedBoardOrderId(order.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        order.id === selectedBoardOrderId
                          ? 'border-[#F26A36]/40 bg-[#F26A36]/10'
                          : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-100">{order.channelOrderId}</p>
                        <span className="text-[11px] text-zinc-400">
                          {new Date(order.placedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-300">{order.customerName}</p>
                      <p className="mt-1 text-[11px] text-zinc-500">{order.items.join(', ')}</p>
                    </button>
                  ))}
                  {!orderBoardOrders.length ? (
                    <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-5 text-center text-xs text-zinc-500">
                      {copy.orderBoardEmpty}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                {!selectedBoardOrder ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500">
                    {copy.orderBoardSelectOrder}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <InfoRow label={copy.queryTableOrderId} value={selectedBoardOrder.channelOrderId} />
                    <InfoRow
                      label={copy.queryTablePlatform}
                      value={platformLabel(selectedBoardOrder.platform)}
                    />
                    <InfoRow label={copy.customer} value={selectedBoardOrder.customerName} />
                    <InfoRow label={copy.amount} value={`$${selectedBoardOrder.amount.toFixed(2)}`} />
                    <InfoRow label={copy.eta} value={`${selectedBoardOrder.etaMins}m`} />
                    <InfoRow label={copy.placedAt} value={new Date(selectedBoardOrder.placedAt).toLocaleString()} />
                    <InfoRow label={copy.notes} value={selectedBoardOrder.notes || '-'} />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                {!selectedBoardOrder ? (
                  <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500">
                    {copy.orderBoardSelectOrder}
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-100">{copy.orderBoardReceipt}</p>
                      <Badge className="border-zinc-700 bg-zinc-900/70 text-zinc-300">
                        {copy.orderStatus[selectedBoardOrder.status]}
                      </Badge>
                    </div>
                    <ul className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                      {selectedBoardOrder.items.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex items-start justify-between gap-2">
                          <span>{item}</span>
                          <span className="text-zinc-500">x1</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <OrderActionButtons order={selectedBoardOrder} onUpdate={updateOrder} copy={copy} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderMenuWorkspace = () => {
    const menuPlatforms = state.platforms.map((platform) => platform.key);

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{copy.nav.menu}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
              <label className="space-y-1">
                <span className="text-xs text-zinc-500">{copy.searchByName}</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(event) => setMenuSearch(event.target.value)}
                    placeholder={lang === 'zh' ? '输入菜品名称' : 'Search item name'}
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                  />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-zinc-500">{copy.tableCategory}</span>
                <select
                  value={menuCategoryFilter}
                  onChange={(event) => setMenuCategoryFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                >
                  <option value="all">{copy.allCategories}</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-zinc-500">{copy.filterByPlatform}</span>
                <select
                  value={menuPlatformFilter}
                  onChange={(event) => setMenuPlatformFilter(event.target.value as 'all' | DeliveryPlatformKey)}
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
                >
                  <option value="all">{copy.allPlatforms}</option>
                  {state.platforms.map((platform) => (
                    <option key={platform.key} value={platform.key}>
                      {platform.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button
                  size="md"
                  variant="secondary"
                  className="h-10"
                  onClick={() => {
                    setMenuSearch('');
                    setMenuCategoryFilter('all');
                    setMenuPlatformFilter('all');
                    setMenuConnectedOnly(false);
                  }}
                >
                  <Filter className="h-4 w-4" />
                  {copy.clearFilters}
                </Button>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
              <span className="text-xs text-zinc-400">{copy.showConnectedOnly}</span>
              <button
                type="button"
                onClick={() => setMenuConnectedOnly((prev) => !prev)}
                className={`h-6 w-12 rounded-full border px-1 transition ${
                  menuConnectedOnly ? 'border-[#F26A36]/50 bg-[#F26A36]/20' : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition ${
                    menuConnectedOnly ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>

            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{copy.showingItems}</span>
              <span className="font-semibold text-zinc-200">{filteredMenu.length}</span>
            </div>

            <div className="space-y-3 lg:hidden">
              {filteredMenu.map((item) => (
                <div key={`mobile-menu-${item.id}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{item.name}</p>
                      <p className="mt-1 text-xs text-zinc-400">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-100">${item.basePrice.toFixed(2)}</p>
                      <Badge
                        className={
                          item.stock === 'in_stock'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : item.stock === 'low'
                              ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                              : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }
                      >
                        {copy.stock[item.stock]}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {menuPlatforms.map((platformKey) => (
                      <div
                        key={`mobile-${item.id}-${platformKey}`}
                        className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2"
                      >
                        <p className="mb-1 text-[11px] text-zinc-500">
                          {state.platforms.find((platform) => platform.key === platformKey)?.label ?? platformKey}
                        </p>
                        <ChannelPriceEditor
                          key={`${item.id}-${platformKey}-${String(item.channels[platformKey]?.enabled)}-${String(item.channels[platformKey]?.price ?? item.basePrice)}-mobile`}
                          enabled={Boolean(item.channels[platformKey]?.enabled)}
                          price={item.channels[platformKey]?.price ?? item.basePrice}
                          onSubmit={(enabled, price) => updateChannelPrice(item.id, platformKey, enabled, price)}
                          disabled={saving}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant={item.available ? 'secondary' : 'ghost'}
                      onClick={() => toggleItemListing(item.id, !item.available)}
                      disabled={saving}
                      className="w-full"
                    >
                      {item.available ? copy.listed : copy.hidden}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60 lg:block">
              <table className="min-w-[1120px] w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">{copy.tableDish}</th>
                    <th className="px-3 py-2 text-left">{copy.tableCategory}</th>
                    <th className="px-3 py-2 text-right">{copy.tableBasePrice}</th>
                    {menuPlatforms.map((platformKey) => (
                      <th key={`head-${platformKey}`} className="px-3 py-2 text-left">
                        {state.platforms.find((platform) => platform.key === platformKey)?.label ?? platformKey}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left">{copy.tableStock}</th>
                    <th className="px-3 py-2 text-left">{copy.tableAvailable}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenu.map((item) => (
                    <tr key={item.id} className="border-t border-zinc-800">
                      <td className="px-3 py-3 font-medium text-zinc-100">{item.name}</td>
                      <td className="px-3 py-3 text-zinc-400">{item.category}</td>
                      <td className="px-3 py-3 text-right text-zinc-100">${item.basePrice.toFixed(2)}</td>
                      {menuPlatforms.map((platformKey) => (
                        <td key={`${item.id}-${platformKey}`} className="px-3 py-3">
                          <ChannelPriceEditor
                            key={`${item.id}-${platformKey}-${String(item.channels[platformKey]?.enabled)}-${String(item.channels[platformKey]?.price ?? item.basePrice)}`}
                            enabled={Boolean(item.channels[platformKey]?.enabled)}
                            price={item.channels[platformKey]?.price ?? item.basePrice}
                            onSubmit={(enabled, price) =>
                              updateChannelPrice(item.id, platformKey, enabled, price)
                            }
                            disabled={saving}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <Badge
                          className={
                            item.stock === 'in_stock'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : item.stock === 'low'
                                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                                : 'border-red-500/30 bg-red-500/10 text-red-300'
                          }
                        >
                          {copy.stock[item.stock]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          size="sm"
                          variant={item.available ? 'secondary' : 'ghost'}
                          onClick={() => toggleItemListing(item.id, !item.available)}
                          disabled={saving}
                        >
                          {item.available ? copy.listed : copy.hidden}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!filteredMenu.length ? (
              <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                {copy.noMenuMatch}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderOrderQueryWorkspace = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.orderQueryCenter}</CardTitle>
        <p className="text-sm text-zinc-400">{copy.orderQueryDescription}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{copy.filterByPlatform}</span>
            <select
              value={queryFilters.platform}
              onChange={(event) =>
                setQueryFilters((prev) => ({
                  ...prev,
                  platform: event.target.value as 'all' | DeliveryPlatformKey,
                }))
              }
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
            >
              <option value="all">{copy.allPlatforms}</option>
              {state.platforms.map((platform) => (
                <option key={platform.key} value={platform.key}>
                  {platform.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{copy.filterDateFrom}</span>
            <input
              type="date"
              value={queryFilters.dateFrom}
              onChange={(event) =>
                setQueryFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
              }
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{copy.filterDateTo}</span>
            <input
              type="date"
              value={queryFilters.dateTo}
              onChange={(event) =>
                setQueryFilters((prev) => ({ ...prev, dateTo: event.target.value }))
              }
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{copy.filterCustomer}</span>
            <input
              type="text"
              value={queryFilters.customer}
              onChange={(event) =>
                setQueryFilters((prev) => ({ ...prev, customer: event.target.value }))
              }
              placeholder={lang === 'zh' ? '输入顾客姓名' : 'Customer name'}
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500">{copy.filterKeyword}</span>
            <input
              type="text"
              value={queryFilters.q}
              onChange={(event) =>
                setQueryFilters((prev) => ({ ...prev, q: event.target.value }))
              }
              placeholder={lang === 'zh' ? '订单号或关键词' : 'Order ID / keyword'}
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
            />
          </label>
          <div className="flex items-end gap-2">
            <Button className="h-10 flex-1" onClick={() => searchOrders()} disabled={queryLoading}>
              <Search className="h-4 w-4" />
              {copy.searchOrders}
            </Button>
            <Button className="h-10" variant="secondary" onClick={() => resetOrderFilters()} disabled={queryLoading}>
              <RefreshCw className="h-4 w-4" />
              {copy.resetFilters}
            </Button>
          </div>
        </div>

        {queryWarning ? (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
            {copy.warningPrefix}: {queryWarning}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3 lg:hidden">
            {queryRows.map((row) => (
              <button
                key={`mobile-${row.platform}-${row.id}`}
                type="button"
                onClick={() => loadOrderDetail(row)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedOrderDetail?.order.id === row.id
                    ? 'border-[#F26A36]/40 bg-[#F26A36]/10'
                    : 'border-zinc-800 bg-zinc-950/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{row.customerName}</p>
                    <p className="text-xs text-zinc-400">{row.channelOrderId}</p>
                  </div>
                  <Badge className="border-zinc-700 bg-zinc-900/70 text-zinc-300">
                    {copy.orderStatus[row.status]}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <span>{state.platforms.find((platform) => platform.key === row.platform)?.label ?? row.platform}</span>
                  <span className="text-right">${row.amount.toFixed(2)}</span>
                  <span>{new Date(row.placedAt).toLocaleDateString()}</span>
                  <span className="text-right">{new Date(row.placedAt).toLocaleTimeString()}</span>
                </div>
              </button>
            ))}
            {queryLoading ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-4 text-sm text-zinc-500">
                {copy.loadingOrders}
              </div>
            ) : null}
            {!queryLoading && queryRows.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-6 text-sm text-zinc-500">
                {copy.noQueryOrders}
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">{copy.queryTableOrderId}</th>
                    <th className="px-3 py-2 text-left">{copy.queryTablePlatform}</th>
                    <th className="px-3 py-2 text-left">{copy.queryTableCustomer}</th>
                    <th className="px-3 py-2 text-right">{copy.queryTableAmount}</th>
                    <th className="px-3 py-2 text-left">{copy.queryTableStatus}</th>
                    <th className="px-3 py-2 text-left">{copy.queryTablePlacedAt}</th>
                    <th className="px-3 py-2 text-right">{copy.viewDetails}</th>
                  </tr>
                </thead>
                <tbody>
                  {queryRows.map((row) => (
                    <tr
                      key={`${row.platform}-${row.id}`}
                      className={`border-t border-zinc-800 ${
                        selectedOrderDetail?.order.id === row.id ? 'bg-[#F26A36]/10' : 'hover:bg-zinc-900/70'
                      }`}
                    >
                      <td className="px-3 py-3 font-medium text-zinc-100">{row.channelOrderId}</td>
                      <td className="px-3 py-3 text-zinc-300">
                        {state.platforms.find((platform) => platform.key === row.platform)?.label ?? row.platform}
                      </td>
                      <td className="px-3 py-3 text-zinc-200">{row.customerName}</td>
                      <td className="px-3 py-3 text-right text-zinc-100">${row.amount.toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <Badge className="border-zinc-700 bg-zinc-900/70 text-zinc-300">
                          {copy.orderStatus[row.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-zinc-400">{new Date(row.placedAt).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => loadOrderDetail(row)} disabled={detailLoading}>
                          {copy.viewDetails}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {queryLoading ? (
              <div className="border-t border-zinc-800 px-4 py-4 text-sm text-zinc-500">{copy.loadingOrders}</div>
            ) : null}
            {!queryLoading && queryRows.length === 0 ? (
              <div className="border-t border-zinc-800 px-4 py-6 text-sm text-zinc-500">{copy.noQueryOrders}</div>
            ) : null}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <CalendarRange className="h-4 w-4 text-[#F26A36]" />
              {copy.detailTitle}
            </div>
            {!selectedOrderDetail ? (
              <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500">
                {copy.detailHint}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2 text-xs md:grid-cols-2">
                  <InfoRow label={copy.queryTableOrderId} value={selectedOrderDetail.order.channelOrderId} />
                  <InfoRow
                    label={copy.queryTablePlatform}
                    value={state.platforms.find((platform) => platform.key === selectedOrderDetail.order.platform)?.label ?? selectedOrderDetail.order.platform}
                  />
                  <InfoRow label={copy.queryTableCustomer} value={selectedOrderDetail.order.customerName} />
                  <InfoRow label={copy.queryTableAmount} value={`$${selectedOrderDetail.order.amount.toFixed(2)}`} />
                  <InfoRow label={copy.queryTableStatus} value={copy.orderStatus[selectedOrderDetail.order.status]} />
                  <InfoRow
                    label={copy.queryTablePlacedAt}
                    value={new Date(selectedOrderDetail.order.placedAt).toLocaleString()}
                  />
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
                  {copy.sourceLabel}: {selectedOrderDetail.source === 'api' ? copy.detailSourceApi : copy.detailSourceFallback}
                </div>
                <pre className="max-h-[420px] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-[11px] leading-relaxed text-zinc-200">
                  {JSON.stringify(selectedOrderDetail.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderAutomationWorkspace = () => (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <AutomationCard
        key={`automation-${state.updatedAt}`}
        copy={copy}
        automation={state.automation}
        saving={saving}
        onSave={saveAutomation}
        lang={lang}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.nav.orders}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.platforms.map((platform) => {
            const connected = isPlatformConnected(platform.key);
            return (
              <div key={platform.key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-100">{platform.label}</p>
                  <Badge
                    className={
                      platform.status === 'connected'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : platform.status === 'issue'
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : 'border-zinc-700 bg-zinc-900/70 text-zinc-300'
                    }
                  >
                    {copy.platformStatus[platform.status]}
                  </Badge>
                </div>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span>{copy.queue}</span>
                    <span className="font-semibold text-zinc-100">{platform.queueSize}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{copy.prep}</span>
                    <span className="font-semibold text-zinc-100">
                      {platform.avgPrepMins > 0 ? `${platform.avgPrepMins}m` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{copy.syncedAt}</span>
                    <span className="font-semibold text-zinc-100">
                      {platform.menuSyncedAt ? new Date(platform.menuSyncedAt).toLocaleTimeString() : copy.noSync}
                    </span>
                  </div>
                </div>
                <Button
                  className="mt-4 w-full"
                  variant={platform.acceptsOrders ? 'danger' : 'secondary'}
                  size="sm"
                  onClick={() => togglePlatform(platform, !platform.acceptsOrders)}
                  disabled={!connected || saving}
                >
                  {platform.acceptsOrders ? (
                    <>
                      <WifiOff className="h-4 w-4" />
                      {lang === 'zh' ? '暂停接单' : 'Pause intake'}
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4" />
                      {lang === 'zh' ? '恢复接单' : 'Resume intake'}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );

  const renderWebhookWorkspace = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.webhooks}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.webhookEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
            {copy.noWebhookHint}
          </div>
        ) : (
          state.webhookEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
              <div className="grid gap-2 md:grid-cols-2">
                <InfoRow label={copy.eventTime} value={new Date(event.receivedAt).toLocaleString()} />
                <InfoRow label={copy.eventTopic} value={event.topic || '-'} />
                <InfoRow label={copy.eventType} value={event.eventType || '-'} />
                <InfoRow label={copy.eventStore} value={event.storeId || '-'} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );

  const renderWorkspacePanel = () => {
    switch (workspaceView) {
      case 'orders':
        return renderOrdersWorkspace();
      case 'menu':
        return renderMenuWorkspace();
      case 'query':
        return renderOrderQueryWorkspace();
      case 'automation':
        return renderAutomationWorkspace();
      case 'webhooks':
        return renderWebhookWorkspace();
      default:
        return renderOrdersWorkspace();
    }
  };

  const selectedOrderSummary = selectedBoardOrder
    ? `${selectedBoardOrder.channelOrderId} · ${selectedBoardOrder.customerName}`
    : copy.orderBoardSelectOrder;

  const canAccept = selectedBoardOrder?.status === 'new';
  const canStartPrep = selectedBoardOrder?.status === 'accepted';
  const canMarkReady = selectedBoardOrder?.status === 'preparing';
  const canComplete = selectedBoardOrder?.status === 'ready';
  const canCancel = Boolean(
    selectedBoardOrder && !['completed', 'cancelled'].includes(selectedBoardOrder.status)
  );

  const runQuickOrderAction = async (nextStatus: DeliveryOrderStatus) => {
    if (!selectedBoardOrder) {
      toast.error(copy.orderBoardSelectOrder);
      return;
    }
    await updateOrder(selectedBoardOrder.id, nextStatus);
  };

  const renderCommandCenter = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.commandCenterTitle}</CardTitle>
        <p className="text-sm text-zinc-400">{copy.commandCenterDescription}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1.3fr]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">{copy.workspaceShortcuts}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
              {WORKSPACE_VIEW_ORDER.map((view) => (
                <Button
                  key={`command-${view}`}
                  size="sm"
                  variant={workspaceView === view ? 'primary' : 'secondary'}
                  className="justify-start"
                  onClick={() => setWorkspaceView(view)}
                  disabled={!hasConnectedPlatforms}
                >
                  {copy.nav[view]}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">{copy.globalActions}</p>
            <div className="grid gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="justify-start"
                onClick={() => load()}
                disabled={loading || saving}
              >
                <RefreshCw className="h-4 w-4" />
                {copy.refresh}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="justify-start"
                onClick={runInitialSyncNow}
                disabled={saving || !hasConnectedPlatforms}
              >
                <Layers className="h-4 w-4" />
                {copy.runSyncNow}
              </Button>
              <Button
                size="sm"
                className="justify-start"
                onClick={publishMenu}
                disabled={saving || !hasConnectedPlatforms}
              >
                <Rocket className="h-4 w-4" />
                {saving ? copy.publishing : copy.publishMenu}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">{copy.fulfillmentPad}</p>
            <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
              <span className="text-zinc-500">{copy.selectedOrderLabel}: </span>
              <span className="font-medium text-zinc-100">{selectedOrderSummary}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={canAccept ? 'primary' : 'secondary'}
                onClick={() => runQuickOrderAction('accepted')}
                disabled={saving || !canAccept}
              >
                {copy.accept}
              </Button>
              <Button
                size="sm"
                variant={canStartPrep ? 'primary' : 'secondary'}
                onClick={() => runQuickOrderAction('preparing')}
                disabled={saving || !canStartPrep}
              >
                {copy.startPrep}
              </Button>
              <Button
                size="sm"
                variant={canMarkReady ? 'primary' : 'secondary'}
                onClick={() => runQuickOrderAction('ready')}
                disabled={saving || !canMarkReady}
              >
                {copy.markReady}
              </Button>
              <Button
                size="sm"
                variant={canComplete ? 'primary' : 'secondary'}
                onClick={() => runQuickOrderAction('completed')}
                disabled={saving || !canComplete}
              >
                {copy.complete}
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="col-span-2"
                onClick={() => runQuickOrderAction('cancelled')}
                disabled={saving || !canCancel}
              >
                {copy.cancel}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">{copy.intakeControls}</p>
          {connectedPlatforms.length === 0 ? (
            <p className="text-xs text-zinc-500">{copy.noConnectedChannels}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {connectedPlatforms.map((platform) => (
                <Button
                  key={`intake-${platform.key}`}
                  size="sm"
                  variant={platform.acceptsOrders ? 'danger' : 'secondary'}
                  className="justify-between"
                  onClick={() => togglePlatform(platform, !platform.acceptsOrders)}
                  disabled={saving}
                >
                  <span className="truncate">{platform.label}</span>
                  {platform.acceptsOrders
                    ? (lang === 'zh' ? '暂停接单' : 'Pause')
                    : (lang === 'zh' ? '恢复接单' : 'Resume')}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
              <RefreshCw className="h-4 w-4" /> {copy.refresh}
            </Button>
            {hasConnectedPlatforms ? (
              <Button onClick={publishMenu} disabled={saving}>
                <Rocket className="h-4 w-4" />
                {saving ? copy.publishing : copy.publishMenu}
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.connectCenterTitle}</CardTitle>
          <p className="text-sm text-zinc-400">{copy.connectCenterDescription}</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {state.platforms.map((platform) => {
            const connected = isPlatformConnected(platform.key);
            return (
              <div
                key={platform.key}
                className={`rounded-xl border p-4 ${
                  connected ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950/60'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-100">{platform.label}</p>
                  <Badge
                    className={
                      connected
                        ? 'whitespace-nowrap border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'whitespace-nowrap border-zinc-700 bg-zinc-900/70 text-zinc-300'
                    }
                  >
                    {connected ? copy.connectedState : copy.unconnectedState}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="h-auto min-h-9 w-full whitespace-normal px-3 py-2 text-center leading-tight"
                    onClick={() => authorizePlatform(platform.key)}
                    disabled={saving}
                  >
                    <Truck className="h-4 w-4" />
                    {copy.authorizeConnect}
                  </Button>
                  <Button
                    size="sm"
                    className="h-auto min-h-9 w-full whitespace-normal px-3 py-2 text-center leading-tight"
                    variant="secondary"
                    onClick={() => disconnectPlatform(platform.key)}
                    disabled={saving || !connected}
                  >
                    {copy.disconnectLink}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {renderCommandCenter()}

      {!hasConnectedPlatforms ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="text-base font-semibold text-zinc-100">{copy.connectFirstTitle}</p>
            <p className="text-sm text-zinc-400">{copy.connectFirstBody}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 py-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title={copy.kpiAcceptance}
                value={`${operationalKpis.acceptanceRate}%`}
                hint={lang === 'zh' ? '已接单 / 总单量' : 'Accepted / total'}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <KpiCard
                title={copy.kpiCancellation}
                value={`${operationalKpis.cancellationRate}%`}
                hint={lang === 'zh' ? '取消单占比' : 'Cancelled ratio'}
                icon={<XCircle className="h-4 w-4" />}
              />
              <KpiCard
                title={copy.kpiAov}
                value={`$${operationalKpis.avgOrderValue.toFixed(2)}`}
                hint={lang === 'zh' ? '实时均价' : 'Live average'}
                icon={<ShoppingBag className="h-4 w-4" />}
              />
              <KpiCard
                title={copy.kpiChannels}
                value={String(operationalKpis.connectedChannels)}
                hint={lang === 'zh' ? '已接入渠道数' : 'Connected channels'}
                icon={<Layers className="h-4 w-4" />}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="grid xl:grid-cols-[240px_1fr]">
              <aside className="hidden border-r border-zinc-800 bg-zinc-950/80 p-4 xl:block">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-zinc-100">{copy.workspaceTitle}</p>
                  <p className="mt-1 text-xs text-zinc-400">{copy.workspaceDescription}</p>
                </div>

                <nav className="space-y-2">
                  {WORKSPACE_VIEW_ORDER.map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setWorkspaceView(view)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                        workspaceView === view
                          ? 'border-[#F26A36]/40 bg-[#F26A36]/10 text-[#F7A27F]'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <span>{copy.nav[view]}</span>
                      {view === 'orders' ? <Badge>{state.orders.length}</Badge> : null}
                    </button>
                  ))}
                </nav>

                <div className="mt-5 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                  {connectedPlatforms.map((platform) => (
                    <div key={`connected-${platform.key}`} className="flex items-center justify-between text-xs text-zinc-300">
                      <span>{platform.label}</span>
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{copy.connectedState}</Badge>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="p-4 md:p-5">
                <div className="mb-4 space-y-3 xl:hidden">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{copy.workspaceTitle}</p>
                    <p className="mt-1 text-xs text-zinc-400">{copy.workspaceDescription}</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {WORKSPACE_VIEW_ORDER.map((view) => (
                      <button
                        key={`mobile-${view}`}
                        type="button"
                        onClick={() => setWorkspaceView(view)}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-xs transition ${
                          workspaceView === view
                            ? 'border-[#F26A36]/40 bg-[#F26A36]/10 text-[#F7A27F]'
                            : 'border-zinc-800 bg-zinc-900/40 text-zinc-300'
                        }`}
                      >
                        <span>{copy.nav[view]}</span>
                        {view === 'orders' ? <span className="ml-1 text-zinc-400">({state.orders.length})</span> : null}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {connectedPlatforms.map((platform) => (
                      <div
                        key={`mobile-connected-${platform.key}`}
                        className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-xs text-zinc-300"
                      >
                        <div className="flex items-center justify-between">
                          <span>{platform.label}</span>
                          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                            {copy.connectedState}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {renderWorkspacePanel()}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-between rounded-xl border px-3 py-2 text-xs transition ${
        active
          ? 'border-[#F26A36]/40 bg-[#F26A36]/10 text-[#F7A27F]'
          : 'border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700'
      }`}
    >
      <span>{label}</span>
      <span className="ml-2 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">{count}</span>
    </button>
  );
}

function OrderMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function OrderActionButtons({
  order,
  onUpdate,
  copy,
}: {
  order: DeliveryOrderTicket;
  onUpdate: (orderId: string, status: DeliveryOrderStatus) => void;
  copy: Pick<Copy, 'accept' | 'startPrep' | 'markReady' | 'complete' | 'cancel'>;
}) {
  const nextAction =
    order.status === 'new'
      ? { label: copy.accept, status: 'accepted' as const }
      : order.status === 'accepted'
      ? { label: copy.startPrep, status: 'preparing' as const }
      : order.status === 'preparing'
      ? { label: copy.markReady, status: 'ready' as const }
      : order.status === 'ready'
      ? { label: copy.complete, status: 'completed' as const }
      : null;

  if (!nextAction) {
    return null;
  }

  return (
    <>
      <Button size="sm" onClick={() => onUpdate(order.id, nextAction.status)}>
        {nextAction.label}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onUpdate(order.id, 'cancelled')}>
        {copy.cancel}
      </Button>
    </>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-2 flex items-center justify-between text-zinc-400">
        <p className="text-xs uppercase tracking-wide">{title}</p>
        {icon}
      </div>
      <p className="text-2xl font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function ChannelPriceEditor({
  enabled,
  price,
  disabled,
  onSubmit,
}: {
  enabled: boolean;
  price: number;
  disabled: boolean;
  onSubmit: (enabled: boolean, price: number) => void;
}) {
  const [localEnabled, setLocalEnabled] = useState(() => enabled);
  const [localPrice, setLocalPrice] = useState(() => String(price.toFixed(2)));

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          const next = !localEnabled;
          setLocalEnabled(next);
          const nextPrice = Number(localPrice);
          if (Number.isFinite(nextPrice)) onSubmit(next, nextPrice);
        }}
        className={`h-8 rounded-lg border px-2 text-xs ${
          localEnabled
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
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
        onChange={(event) => setLocalPrice(event.target.value)}
        onBlur={() => {
          const parsed = Number(localPrice);
          if (Number.isFinite(parsed)) onSubmit(localEnabled, parsed);
        }}
        disabled={disabled}
        className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/60"
      />
    </div>
  );
}

function AutomationCard({
  automation,
  onSave,
  copy,
  saving,
  lang,
}: {
  automation: DeliveryAutomationConfig;
  onSave: (next: DeliveryAutomationConfig) => Promise<void>;
  copy: Pick<
    Copy,
    | 'automation'
    | 'autoAccept'
    | 'autoAcceptCap'
    | 'pauseQueue'
    | 'prepBuffer'
    | 'weekendMarkup'
    | 'saveAutomation'
  >;
  saving: boolean;
  lang: 'zh' | 'en';
}) {
  const [local, setLocal] = useState(() => automation);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.automation}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <span className="text-sm text-zinc-200">{copy.autoAccept}</span>
          <button
            type="button"
            onClick={() =>
              setLocal((prev) => ({
                ...prev,
                autoAcceptLowRisk: !prev.autoAcceptLowRisk,
              }))
            }
            className={`h-7 w-14 rounded-full border px-1 transition ${
              local.autoAcceptLowRisk
                ? 'border-[#F26A36]/50 bg-[#F26A36]/20'
                : 'border-zinc-700 bg-zinc-900'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition ${
                local.autoAcceptLowRisk ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
        <NumberField
          icon={<ShoppingBag className="h-4 w-4" />}
          label={copy.autoAcceptCap}
          value={local.maxAutoAcceptAmount}
          onChange={(value) => setLocal((prev) => ({ ...prev, maxAutoAcceptAmount: value }))}
        />
        <NumberField
          icon={<BellRing className="h-4 w-4" />}
          label={copy.pauseQueue}
          value={local.pauseWhenQueueExceeds}
          onChange={(value) => setLocal((prev) => ({ ...prev, pauseWhenQueueExceeds: value }))}
        />
        <NumberField
          icon={<PackageCheck className="h-4 w-4" />}
          label={copy.prepBuffer}
          value={local.prepBufferMins}
          onChange={(value) => setLocal((prev) => ({ ...prev, prepBufferMins: value }))}
        />
        <NumberField
          icon={<Settings2 className="h-4 w-4" />}
          label={copy.weekendMarkup}
          value={local.weekendMarkupPct}
          onChange={(value) => setLocal((prev) => ({ ...prev, weekendMarkupPct: value }))}
        />
        <Button className="w-full" onClick={() => onSave(local)} disabled={saving}>
          {copy.saveAutomation}
        </Button>
        <p className="text-xs text-zinc-500">
          {lang === 'zh'
            ? '自动化策略用于控制高峰期接单与利润保护。'
            : 'Automation policy controls intake pressure and margin protection during peaks.'}
        </p>
      </CardContent>
    </Card>
  );
}

function NumberField({
  icon,
  label,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="flex items-center gap-2 text-sm text-zinc-300">
        {icon}
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/70"
      />
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-xs text-zinc-100">{value}</p>
    </div>
  );
}
