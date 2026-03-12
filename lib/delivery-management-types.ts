export type DeliveryPlatformKey =
  | 'ubereats'
  | 'doordash'
  | 'grubhub'
  | 'fantuan'
  | 'hungrypanda';

export type DeliveryOnboardingStep =
  | 'platforms'
  | 'subscription'
  | 'authorization'
  | 'sync'
  | 'operations';

export type DeliverySubscriptionPlan = 'starter' | 'growth' | 'enterprise';
export type DeliveryAccessRequestStatus =
  | 'not_requested'
  | 'requested'
  | 'approved'
  | 'rejected';
export type DeliveryAuthStatus = 'not_started' | 'pending' | 'connected' | 'failed';
export type DeliverySyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export type DeliveryPlatformStatus = 'connected' | 'not_connected' | 'issue';
export type DeliveryOrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';
export type DeliveryStockStatus = 'in_stock' | 'low' | 'out';
export type DeliveryStoreOnlineStatus = 'online' | 'paused';
export type DeliveryWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type DeliveryTimeRange = {
  startTime: string;
  endTime: string;
};

export type DeliveryRegularHours = Partial<Record<DeliveryWeekday, DeliveryTimeRange[]>>;

export type DeliveryHolidayHoursEntry = {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  closed?: boolean;
};

export type DeliveryPromotionDraftType = 'percentage' | 'fixed_amount' | 'bogo' | 'threshold';

export type DeliveryPromotionDraft = {
  id: string;
  name: string;
  type: DeliveryPromotionDraftType;
  value: number;
  enabled: boolean;
  startAt: string;
  endAt: string;
  target: 'store' | 'menu_item';
  targetIds: string[];
  syncStatus: 'idle' | 'pending' | 'synced' | 'error';
  lastError?: string;
};

export type DeliveryStoreOperationsState = {
  storeId: string;
  storeName: string;
  onlineStatus: DeliveryStoreOnlineStatus;
  prepTimeOffsetMins: number;
  defaultPrepTimeMins: number;
  regularHours: DeliveryRegularHours;
  holidayHours: DeliveryHolidayHoursEntry[];
  promotions: DeliveryPromotionDraft[];
  lastPulledAt?: string;
  lastPushedAt?: string;
  syncSource: 'local' | 'live';
  syncWarnings: string[];
};

export type DeliveryPlatformConnection = {
  key: DeliveryPlatformKey;
  label: string;
  status: DeliveryPlatformStatus;
  acceptsOrders: boolean;
  queueSize: number;
  avgPrepMins: number;
  menuSyncedAt?: string;
};

export type DeliveryMenuItem = {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  stock: DeliveryStockStatus;
  available: boolean;
  channels: Partial<Record<DeliveryPlatformKey, { enabled: boolean; price: number }>>;
};

export type DeliveryOrderTicket = {
  id: string;
  channelOrderId: string;
  platform: DeliveryPlatformKey;
  customerName: string;
  items: string[];
  amount: number;
  status: DeliveryOrderStatus;
  placedAt: string;
  etaMins: number;
  notes?: string;
};

export type DeliveryOrderQueryRow = {
  id: string;
  channelOrderId: string;
  platform: DeliveryPlatformKey;
  customerName: string;
  status: DeliveryOrderStatus;
  placedAt: string;
  amount: number;
  etaMins: number;
  storeId?: string;
  source: 'api' | 'fallback';
};

export type DeliveryOrderQueryResponse = {
  orders: DeliveryOrderQueryRow[];
  total: number;
  source: 'live_api' | 'fallback' | 'mixed';
  warning?: string;
};

export type DeliveryOrderDetailResponse = {
  order: DeliveryOrderQueryRow;
  details: Record<string, unknown>;
  source: 'api' | 'fallback';
  fetchedAt: string;
  warning?: string;
};

export type DeliveryAutomationConfig = {
  autoAcceptLowRisk: boolean;
  maxAutoAcceptAmount: number;
  pauseWhenQueueExceeds: number;
  prepBufferMins: number;
  weekendMarkupPct: number;
};

export type DeliveryWebhookEvent = {
  id: string;
  receivedAt: string;
  topic?: string;
  eventType?: string;
  storeId?: string;
};

export type DeliveryOnboardingPlatformState = {
  key: DeliveryPlatformKey;
  accessRequestStatus: DeliveryAccessRequestStatus;
  authStatus: DeliveryAuthStatus;
  syncStatus: DeliverySyncStatus;
  lastSyncAt?: string;
  note?: string;
};

export type DeliveryOnboardingChecklist = {
  requestSubmitted: boolean;
  subscriptionActivated: boolean;
  authorizationCompleted: boolean;
  initialSyncCompleted: boolean;
  goLiveReady: boolean;
};

export type DeliveryOnboardingState = {
  step: DeliveryOnboardingStep;
  selectedPlatforms: DeliveryPlatformKey[];
  subscriptionPlan: DeliverySubscriptionPlan;
  subscriptionActive: boolean;
  platformStates: DeliveryOnboardingPlatformState[];
  checklist: DeliveryOnboardingChecklist;
};

export type DeliveryUxBenchmark = {
  platform: 'deliverect' | 'otter' | 'streamorder';
  strengths: string[];
  painPoints: string[];
  adoptedInRestaurantIQ: string[];
};

export type DeliveryManagementState = {
  updatedAt: string;
  lastPublishedAt?: string;
  platforms: DeliveryPlatformConnection[];
  menu: DeliveryMenuItem[];
  orders: DeliveryOrderTicket[];
  automation: DeliveryAutomationConfig;
  webhookEvents: DeliveryWebhookEvent[];
  storeOps: DeliveryStoreOperationsState[];
  onboarding: DeliveryOnboardingState;
  uxBenchmarks: DeliveryUxBenchmark[];
};
