import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  DeliveryAuthStatus,
  DeliveryHolidayHoursEntry,
  DeliveryOnboardingPlatformState,
  DeliveryOnboardingStep,
  DeliveryPlatformKey,
  DeliveryManagementState,
  DeliveryOrderStatus,
  DeliveryPlatformConnection,
  DeliveryRegularHours,
  DeliveryStoreOperationsState,
  DeliverySubscriptionPlan,
  DeliverySyncStatus,
  DeliveryUxBenchmark,
} from '@/lib/delivery-management-types';

const runtimeDir = path.join(process.cwd(), '.runtime', 'delivery-management');

function sanitizeUserKey(userKey: string) {
  return userKey.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function runtimePath(userKey: string) {
  return path.join(runtimeDir, `${sanitizeUserKey(userKey)}.json`);
}

async function ensureRuntimeDir() {
  await mkdir(runtimeDir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function parseEnvStoreIds() {
  const raw = process.env.UBEREATS_STORE_IDS || '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function defaultRegularHours(): DeliveryRegularHours {
  return {
    monday: [{ startTime: '11:00', endTime: '21:00' }],
    tuesday: [{ startTime: '11:00', endTime: '21:00' }],
    wednesday: [{ startTime: '11:00', endTime: '21:00' }],
    thursday: [{ startTime: '11:00', endTime: '21:00' }],
    friday: [{ startTime: '11:00', endTime: '22:00' }],
    saturday: [{ startTime: '11:00', endTime: '22:00' }],
    sunday: [{ startTime: '11:00', endTime: '21:00' }],
  };
}

function defaultHolidayHours(now: string): DeliveryHolidayHoursEntry[] {
  const date = now.slice(0, 10);
  return [
    {
      id: `hh-${date}`,
      date,
      startTime: '12:00',
      endTime: '20:00',
      closed: false,
    },
  ];
}

function createDefaultStoreOpsState(storeId: string, storeName: string): DeliveryStoreOperationsState {
  const now = nowIso();
  return {
    storeId,
    storeName,
    onlineStatus: 'online',
    prepTimeOffsetMins: 0,
    defaultPrepTimeMins: 20,
    regularHours: defaultRegularHours(),
    holidayHours: defaultHolidayHours(now),
    promotions: [
      {
        id: `promo-${storeId}-1`,
        name: 'Weekday Lunch 10% Off',
        type: 'percentage',
        value: 10,
        enabled: false,
        startAt: `${now.slice(0, 10)}T11:00:00`,
        endAt: `${now.slice(0, 10)}T14:00:00`,
        target: 'store',
        targetIds: [storeId],
        syncStatus: 'idle',
      },
    ],
    syncSource: 'local',
    syncWarnings: [],
    lastPulledAt: now,
  };
}

function defaultStoreOps(): DeliveryStoreOperationsState[] {
  const storeIds = parseEnvStoreIds();
  if (!storeIds.length) {
    return [createDefaultStoreOpsState('ubereats-sandbox-store', 'Uber Eats Sandbox Store')];
  }
  return storeIds.map((storeId, index) =>
    createDefaultStoreOpsState(storeId, `Uber Eats Store ${index + 1}`)
  );
}

function platformRows(): DeliveryPlatformConnection[] {
  const baseTime = nowIso();
  return [
    {
      key: 'ubereats',
      label: 'Uber Eats',
      status: 'connected',
      acceptsOrders: true,
      queueSize: 4,
      avgPrepMins: 17,
      menuSyncedAt: baseTime,
    },
    {
      key: 'doordash',
      label: 'DoorDash',
      status: 'not_connected',
      acceptsOrders: false,
      queueSize: 0,
      avgPrepMins: 0,
    },
    {
      key: 'grubhub',
      label: 'Grubhub',
      status: 'not_connected',
      acceptsOrders: false,
      queueSize: 0,
      avgPrepMins: 0,
    },
    {
      key: 'fantuan',
      label: 'Fantuan',
      status: 'not_connected',
      acceptsOrders: false,
      queueSize: 0,
      avgPrepMins: 0,
    },
    {
      key: 'hungrypanda',
      label: 'HungryPanda',
      status: 'not_connected',
      acceptsOrders: false,
      queueSize: 0,
      avgPrepMins: 0,
    },
  ];
}

const onboardingSteps: DeliveryOnboardingStep[] = [
  'platforms',
  'subscription',
  'authorization',
  'sync',
  'operations',
];

function createDefaultOnboardingPlatformStates(): DeliveryOnboardingPlatformState[] {
  const keys: DeliveryPlatformKey[] = [
    'ubereats',
    'doordash',
    'grubhub',
    'fantuan',
    'hungrypanda',
  ];
  return keys.map((key) => ({
    key,
    accessRequestStatus: key === 'ubereats' ? 'approved' : 'not_requested',
    authStatus: key === 'ubereats' ? 'connected' : 'not_started',
    syncStatus: key === 'ubereats' ? 'synced' : 'idle',
    lastSyncAt: key === 'ubereats' ? nowIso() : undefined,
  }));
}

function defaultUxBenchmarks(): DeliveryUxBenchmark[] {
  return [
    {
      platform: 'deliverect',
      strengths: [
        '高密度运营看板，接单和履约状态切换效率高',
        '菜单发布与渠道同步路径短，适合高频改价',
      ],
      painPoints: [
        '开通流程对新商家不够友好，配置路径偏工程化',
        '异常订单解释信息不足，需切换页面排查',
      ],
      adoptedInRestaurantIQ: [
        '保留高密度履约看板 + 状态卡片',
        '统一菜单运营控制台与一键发布',
        '加入异常原因提示与可执行动作建议',
      ],
    },
    {
      platform: 'otter',
      strengths: [
        '接入流程引导完整，能清楚看到下一步',
        '多平台聚合能力强，订单与菜单入口清晰',
      ],
      painPoints: [
        '订阅与接入关系不够透明，用户对费用点位困惑',
        '授权成功后首次同步反馈不够实时',
      ],
      adoptedInRestaurantIQ: [
        '拆分为申请接入 → 订阅 → 授权 → 同步 → 上线五步向导',
        '每步显示完成状态与阻塞原因',
        '同步阶段展示实时状态和最近事件',
      ],
    },
    {
      platform: 'streamorder',
      strengths: [
        '品牌与商家运营流程结合紧密，操作语义接近门店语言',
        '订单处理链路短，前线员工学习成本低',
      ],
      painPoints: [
        '深度运营指标较少，复盘分析能力弱',
        '跨平台一致性控制相对薄弱',
      ],
      adoptedInRestaurantIQ: [
        '以门店任务语义组织接单/制作/出餐流程',
        '补齐跨平台一致性策略与自动化阈值',
        '增加Webhook事件审计，支持快速问题追踪',
      ],
    },
  ];
}

function defaultSubscriptionPlan(): DeliverySubscriptionPlan {
  return 'growth';
}

export function createDefaultDeliveryManagementState(): DeliveryManagementState {
  const now = nowIso();
  const onboardingPlatformStates = createDefaultOnboardingPlatformStates();
  return {
    updatedAt: now,
    lastPublishedAt: now,
    platforms: platformRows(),
    menu: [
      {
        id: 'm-1',
        name: 'Signature BBQ Platter',
        category: 'Signature',
        basePrice: 32.9,
        stock: 'in_stock',
        available: true,
        channels: {
          ubereats: { enabled: true, price: 34.9 },
          doordash: { enabled: false, price: 34.9 },
          grubhub: { enabled: false, price: 34.9 },
        },
      },
      {
        id: 'm-2',
        name: 'Roast Duck Bento',
        category: 'Combo',
        basePrice: 18.5,
        stock: 'low',
        available: true,
        channels: {
          ubereats: { enabled: true, price: 19.5 },
          doordash: { enabled: false, price: 19.5 },
          fantuan: { enabled: false, price: 19.5 },
        },
      },
      {
        id: 'm-3',
        name: 'Cold Noodle Set',
        category: 'Seasonal',
        basePrice: 14.8,
        stock: 'in_stock',
        available: true,
        channels: {
          ubereats: { enabled: true, price: 15.5 },
          doordash: { enabled: false, price: 15.5 },
          hungrypanda: { enabled: false, price: 15.5 },
        },
      },
      {
        id: 'm-4',
        name: 'Pork Soup Dumpling (12)',
        category: 'Dim Sum',
        basePrice: 13.2,
        stock: 'out',
        available: false,
        channels: {
          ubereats: { enabled: false, price: 13.9 },
          doordash: { enabled: false, price: 13.9 },
        },
      },
    ],
    menuBranches: [],
    orders: [
      {
        id: 'o-1',
        channelOrderId: 'UE-82041',
        platform: 'ubereats',
        customerName: 'A. Wong',
        items: ['Signature BBQ Platter', 'Cold Noodle Set'],
        amount: 50.4,
        status: 'new',
        placedAt: now,
        etaMins: 34,
        notes: 'No cilantro',
      },
      {
        id: 'o-2',
        channelOrderId: 'UE-82042',
        platform: 'ubereats',
        customerName: 'M. Chen',
        items: ['Roast Duck Bento'],
        amount: 21.1,
        status: 'preparing',
        placedAt: now,
        etaMins: 22,
      },
      {
        id: 'o-3',
        channelOrderId: 'UE-82043',
        platform: 'ubereats',
        customerName: 'J. Lee',
        items: ['Pork Soup Dumpling (12)'],
        amount: 15.0,
        status: 'accepted',
        placedAt: now,
        etaMins: 19,
      },
    ],
    automation: {
      autoAcceptLowRisk: false,
      maxAutoAcceptAmount: 35,
      pauseWhenQueueExceeds: 18,
      prepBufferMins: 4,
      weekendMarkupPct: 4,
    },
    webhookEvents: [],
    storeOps: defaultStoreOps(),
    onboarding: {
      step: 'platforms',
      selectedPlatforms: ['ubereats'],
      subscriptionPlan: defaultSubscriptionPlan(),
      subscriptionActive: true,
      platformStates: onboardingPlatformStates,
      checklist: {
        requestSubmitted: true,
        subscriptionActivated: true,
        authorizationCompleted: true,
        initialSyncCompleted: true,
        goLiveReady: false,
      },
    },
    uxBenchmarks: defaultUxBenchmarks(),
  };
}

function isOnboardingStep(value: unknown): value is DeliveryOnboardingStep {
  return typeof value === 'string' && onboardingSteps.includes(value as DeliveryOnboardingStep);
}

function normalizeOnboardingPlatformState(
  value: unknown,
  fallback: DeliveryOnboardingPlatformState
): DeliveryOnboardingPlatformState {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Partial<DeliveryOnboardingPlatformState>;

  const authStatuses: DeliveryAuthStatus[] = ['not_started', 'pending', 'connected', 'failed'];
  const syncStatuses: DeliverySyncStatus[] = ['idle', 'syncing', 'synced', 'error'];

  return {
    key: record.key ?? fallback.key,
    accessRequestStatus:
      record.accessRequestStatus ?? fallback.accessRequestStatus,
    authStatus: authStatuses.includes(record.authStatus as DeliveryAuthStatus)
      ? (record.authStatus as DeliveryAuthStatus)
      : fallback.authStatus,
    syncStatus: syncStatuses.includes(record.syncStatus as DeliverySyncStatus)
      ? (record.syncStatus as DeliverySyncStatus)
      : fallback.syncStatus,
    lastSyncAt: record.lastSyncAt ?? fallback.lastSyncAt,
    note: record.note ?? fallback.note,
  };
}

function normalizeDeliveryManagementState(raw: unknown): DeliveryManagementState {
  const base = createDefaultDeliveryManagementState();
  if (!raw || typeof raw !== 'object') return base;

  const record = raw as Partial<DeliveryManagementState>;

  const onboarding = record.onboarding;
  let nextOnboarding = base.onboarding;
  if (onboarding && typeof onboarding === 'object') {
    const onboardingRecord = onboarding as Partial<DeliveryManagementState['onboarding']>;
    const byKey = new Map(
      (onboardingRecord.platformStates || []).map((entry) => [entry.key, entry])
    );
    nextOnboarding = {
      step: isOnboardingStep(onboardingRecord.step)
        ? onboardingRecord.step
        : base.onboarding.step,
      selectedPlatforms:
        onboardingRecord.selectedPlatforms?.filter(Boolean) ??
        base.onboarding.selectedPlatforms,
      subscriptionPlan: onboardingRecord.subscriptionPlan ?? base.onboarding.subscriptionPlan,
      subscriptionActive:
        onboardingRecord.subscriptionActive ?? base.onboarding.subscriptionActive,
      platformStates: base.onboarding.platformStates.map((fallback) =>
        normalizeOnboardingPlatformState(byKey.get(fallback.key), fallback)
      ),
      checklist: {
        requestSubmitted:
          onboardingRecord.checklist?.requestSubmitted ??
          base.onboarding.checklist.requestSubmitted,
        subscriptionActivated:
          onboardingRecord.checklist?.subscriptionActivated ??
          base.onboarding.checklist.subscriptionActivated,
        authorizationCompleted:
          onboardingRecord.checklist?.authorizationCompleted ??
          base.onboarding.checklist.authorizationCompleted,
        initialSyncCompleted:
          onboardingRecord.checklist?.initialSyncCompleted ??
          base.onboarding.checklist.initialSyncCompleted,
        goLiveReady:
          onboardingRecord.checklist?.goLiveReady ??
          base.onboarding.checklist.goLiveReady,
      },
    };
  }

  return {
    ...base,
    ...record,
    platforms: record.platforms || base.platforms,
    menu: record.menu || base.menu,
    menuBranches: Array.isArray(record.menuBranches) ? record.menuBranches : base.menuBranches,
    orders: record.orders || base.orders,
    automation: record.automation || base.automation,
    webhookEvents: record.webhookEvents || base.webhookEvents,
    storeOps: record.storeOps || base.storeOps,
    onboarding: nextOnboarding,
    uxBenchmarks: record.uxBenchmarks || base.uxBenchmarks,
  };
}

export async function loadDeliveryManagementState(userKey: string) {
  try {
    const raw = await readFile(runtimePath(userKey), 'utf8');
    return normalizeDeliveryManagementState(JSON.parse(raw));
  } catch {
    return createDefaultDeliveryManagementState();
  }
}

export async function saveDeliveryManagementState(userKey: string, state: DeliveryManagementState) {
  await ensureRuntimeDir();
  const next: DeliveryManagementState = {
    ...state,
    updatedAt: nowIso(),
  };
  await writeFile(runtimePath(userKey), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function applyOrderStatusTransition(
  current: DeliveryOrderStatus,
  next: DeliveryOrderStatus
) {
  // Same status is always valid
  if (current === next) return true;

  // Completed orders cannot transition to other states
  if (current === 'completed') return false;

  // Allow Uber Eats webhook updates to sync state even after cancellation
  // This handles the case where Uber sends status updates that differ from local state
  // The key insight: if Uber reports the order is preparing, we should trust Uber's state
  // This happens when: 1) order was cancelled locally but recovered on Uber side,
  // 2) webhook events arrive out of order, 3) system restarts
  if (current === 'cancelled') {
    // Allow recovery to accepted/preparing/ready from cancelled
    // This is intentional to handle edge cases and Uber state reconciliation
    return ['accepted', 'preparing', 'ready'].includes(next);
  }

  const allowed: Partial<Record<DeliveryOrderStatus, DeliveryOrderStatus[]>> = {
    new: ['accepted', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
    cancelled: ['accepted', 'preparing', 'ready'], // Allow recovery from cancelled
  };
  return (allowed[current] || []).includes(next);
}

export function orderQueueForPlatform(
  orders: DeliveryManagementState['orders'],
  platform: DeliveryPlatformKey
) {
  return orders.filter(
    (row) =>
      row.platform === platform &&
      row.status !== 'completed' &&
      row.status !== 'cancelled'
  ).length;
}