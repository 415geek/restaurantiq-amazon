import { randomUUID } from 'node:crypto';
import type {
  DeliveryManagementState,
  DeliveryMenuItem,
  DeliveryPlatformKey,
} from '@/lib/delivery-management-types';
import type {
  ConversationalOpsCommand,
  OpsActorRole,
  OpsCommandAction,
  OpsCommandActionType,
  OpsCommandStatus,
  OpsCopilotState,
  OpsExecutionChange,
  OpsExecutionPreview,
  OpsPlatformExecutionResult,
  OpsRollbackSnapshot,
} from '@/lib/ops-copilot-types';
import type { RiskLevel } from '@/lib/types';
import { runProviderJsonSchema } from '@/lib/server/llm/provider-json';
import {
  loadOpsRetryQueueState,
  saveOpsRetryQueueState,
  type OpsRetryJob,
  type OpsRetryQueueState,
} from '@/lib/server/ops-retry-queue-store';
import { executePlatformChanges } from '@/lib/server/ops-platform-executor';

type ParsedInstruction = {
  actionType: OpsCommandActionType;
  normalizedIntent: string;
  riskLevel: RiskLevel;
  confidence: number;
  discountMultiplier?: number;
  priceDelta?: number;
  targetItemIds: string[];
  targetItemNames: string[];
  targetPlatforms: DeliveryPlatformKey[];
  targetStores: string[];
  scheduleAt: string | null;
  autoRestoreAt: string | null;
  missingParams: string[];
  warnings: string[];
  notes: string[];
};

type ApplyCommandResult = {
  opsState: OpsCopilotState;
  deliveryState: DeliveryManagementState;
  command: ConversationalOpsCommand;
};

type RetryQueueProcessingResult = {
  opsState: OpsCopilotState;
  deliveryState: DeliveryManagementState;
  queueChanged: boolean;
  processed: number;
};

type ActionInput = {
  userKey: string;
  opsState: OpsCopilotState;
  deliveryState: DeliveryManagementState;
  commandId: string;
  action: OpsCommandAction;
  actorId: string;
  actorRole: OpsActorRole;
  scheduledAt?: string;
  autoRestoreAt?: string;
  note?: string;
  force?: boolean;
};

const STATUS_ORDER: OpsCommandStatus[] = [
  'draft',
  'parsed',
  'awaiting_confirmation',
  'awaiting_approval',
  'scheduled',
  'executing',
  'synced',
  'partially_failed',
  'rolled_back',
  'completed',
  'failed',
  'rejected',
];

const PLATFORM_KEYWORDS: Array<[RegExp, DeliveryPlatformKey]> = [
  [/uber\s*eats|ubereats|uber/iu, 'ubereats'],
  [/door\s*dash|doordash/iu, 'doordash'],
  [/grubhub/iu, 'grubhub'],
  [/饭团|fantuan/iu, 'fantuan'],
  [/熊猫|hungry\s*panda|hungrypanda/iu, 'hungrypanda'],
];

const STORE_PATTERNS = [
  /(sunset|downtown|chinatown|richmond)\s*(店|store)?/giu,
];

const ROLE_CAN_APPROVE: OpsActorRole[] = ['owner', 'internal'];

function nowIso() {
  return new Date().toISOString();
}

function parseDateOrNull(input?: string | null) {
  if (!input) return null;
  const ts = Date.parse(input);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

function deriveConnectedPlatforms(deliveryState: DeliveryManagementState): DeliveryPlatformKey[] {
  const connected = deliveryState.platforms
    .filter((platform) => platform.status === 'connected')
    .map((platform) => platform.key);
  if (connected.length) return connected;
  return deliveryState.onboarding.selectedPlatforms.length
    ? deliveryState.onboarding.selectedPlatforms
    : ['ubereats'];
}

function findMentionedItems(input: string, menu: DeliveryMenuItem[]) {
  const lowered = input.toLowerCase();
  const matched = menu
    .filter((item) => lowered.includes(item.name.toLowerCase()))
    .map((item) => ({ id: item.id, name: item.name }));

  const quoted = Array.from(input.matchAll(/[“"'「](.+?)[”"'」]/g))
    .map((entry) => entry[1]?.trim())
    .filter((item): item is string => Boolean(item));

  for (const phrase of quoted) {
    const found = menu.find((item) => item.name.toLowerCase() === phrase.toLowerCase());
    if (found && !matched.some((item) => item.id === found.id)) {
      matched.push({ id: found.id, name: found.name });
    }
  }

  return { matched, quoted };
}

function detectPlatforms(input: string, connectedPlatforms: DeliveryPlatformKey[]) {
  const selected = new Set<DeliveryPlatformKey>();
  for (const [pattern, key] of PLATFORM_KEYWORDS) {
    if (pattern.test(input)) selected.add(key);
  }

  if (/所有平台|all channels|all platforms/iu.test(input)) {
    connectedPlatforms.forEach((key) => selected.add(key));
  }

  if (!selected.size) connectedPlatforms.forEach((key) => selected.add(key));
  return Array.from(selected);
}

function detectStores(input: string) {
  if (/所有门店|all stores/iu.test(input)) return ['All Stores'];
  const stores: string[] = [];
  for (const pattern of STORE_PATTERNS) {
    for (const match of input.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value) stores.push(value.charAt(0).toUpperCase() + value.slice(1));
    }
  }
  return stores.length ? Array.from(new Set(stores)) : ['Main Store'];
}

function nextWeekday(day: number, base = new Date()) {
  const date = new Date(base);
  const diff = (day + 7 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + diff);
  date.setHours(9, 0, 0, 0);
  return date;
}

function detectSchedule(input: string) {
  const now = new Date();
  let scheduleAt: string | null = null;
  let autoRestoreAt: string | null = null;

  if (/明天|tomorrow/iu.test(input)) {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    scheduleAt = next.toISOString();
  }

  if (/下周一|next monday/iu.test(input)) {
    scheduleAt = nextWeekday(1, now).toISOString();
  }

  const explicitDate = input.match(/(20\d{2}-\d{1,2}-\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/u);
  if (explicitDate) {
    const dateString = explicitDate[1];
    const timeString = explicitDate[2] ?? '09:00';
    const parsed = new Date(`${dateString}T${timeString}:00`);
    if (Number.isFinite(parsed.getTime())) {
      scheduleAt = parsed.toISOString();
    }
  }

  if (/晚高峰|dinner rush/iu.test(input)) {
    const dinner = new Date(now);
    dinner.setHours(18, 0, 0, 0);
    scheduleAt = dinner.toISOString();
    const restore = new Date(dinner);
    restore.setHours(21, 0, 0, 0);
    autoRestoreAt = restore.toISOString();
  }

  const durationDays = input.match(/(\d+)\s*(天|day|days)/iu);
  if (durationDays && scheduleAt) {
    const restore = new Date(scheduleAt);
    restore.setDate(restore.getDate() + Number(durationDays[1]));
    autoRestoreAt = restore.toISOString();
  }

  if (/自动恢复|恢复原价|restore automatically/iu.test(input) && scheduleAt && !autoRestoreAt) {
    const restore = new Date(scheduleAt);
    restore.setDate(restore.getDate() + 1);
    autoRestoreAt = restore.toISOString();
  }

  return { scheduleAt, autoRestoreAt };
}

function detectPriceAction(input: string) {
  const discountMatch = input.match(/(\d+(?:\.\d+)?)\s*折/u);
  if (discountMatch) {
    const fold = Number(discountMatch[1]);
    if (fold > 0 && fold < 10) {
      return {
        actionType: 'discount' as const,
        discountMultiplier: Number((fold / 10).toFixed(4)),
      };
    }
  }

  const percentMatch = input.match(/(\d+(?:\.\d+)?)\s*%/u);
  if (percentMatch && /off|折扣|discount|降价|打折/iu.test(input)) {
    const percent = Number(percentMatch[1]);
    if (percent > 0 && percent < 100) {
      return {
        actionType: 'discount' as const,
        discountMultiplier: Number(((100 - percent) / 100).toFixed(4)),
      };
    }
  }

  const increaseMatch = input.match(/(?:提高|上调|increase|raise)[^\d]{0,8}(\d+(?:\.\d+)?)(?:\s*(美元|刀|dollar|\$))?/iu);
  if (increaseMatch) {
    return {
      actionType: 'price_adjust' as const,
      priceDelta: Number(increaseMatch[1]),
    };
  }

  const decreaseMatch = input.match(/(?:降低|下调|减少|decrease|reduce|lower)[^\d]{0,8}(\d+(?:\.\d+)?)(?:\s*(美元|刀|dollar|\$))?/iu);
  if (decreaseMatch) {
    return {
      actionType: 'price_adjust' as const,
      priceDelta: -Number(decreaseMatch[1]),
    };
  }

  if (/下架|unlist|hide/iu.test(input)) return { actionType: 'unlist' as const };
  if (/上架|relist|restore listing/iu.test(input)) return { actionType: 'relist' as const };
  if (/描述|标签|description|label/iu.test(input)) return { actionType: 'description_update' as const };
  if (/图片|image|photo/iu.test(input)) return { actionType: 'image_update' as const };
  if (/接单阈值|auto.?accept|threshold/iu.test(input)) return { actionType: 'threshold_adjust' as const };
  return { actionType: 'generic' as const };
}

function calculateRiskLevel({
  actionType,
  discountMultiplier,
  priceDelta,
  affectedItemCount,
  affectedPlatformCount,
}: {
  actionType: OpsCommandActionType;
  discountMultiplier?: number;
  priceDelta?: number;
  affectedItemCount: number;
  affectedPlatformCount: number;
}): RiskLevel {
  if (actionType === 'threshold_adjust') return 'high';
  if (actionType === 'unlist' || actionType === 'image_update') return 'high';
  if (discountMultiplier !== undefined && discountMultiplier < 0.8) return 'high';
  if (priceDelta !== undefined && Math.abs(priceDelta) >= 2.5) return 'high';
  if (affectedItemCount >= 5 || affectedPlatformCount >= 3) return 'high';
  if (actionType === 'discount' || actionType === 'price_adjust') return 'medium';
  return 'low';
}

function buildNormalizedIntent(
  actionType: OpsCommandActionType,
  itemNames: string[],
  platforms: DeliveryPlatformKey[],
  stores: string[]
) {
  return [
    `Action=${actionType}`,
    `Items=${itemNames.length ? itemNames.join(', ') : 'unspecified'}`,
    `Platforms=${platforms.join(', ')}`,
    `Stores=${stores.join(', ')}`,
  ].join(' | ');
}

async function enrichParsedInstructionWithLlm(
  input: string,
  parse: ParsedInstruction,
  deliveryState: DeliveryManagementState
): Promise<ParsedInstruction> {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['normalized_intent', 'risk_level', 'confidence', 'notes'],
    properties: {
      normalized_intent: { type: 'string' },
      risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      notes: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      item_names: { type: 'array', items: { type: 'string' }, maxItems: 8 },
      platform_keys: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['ubereats', 'doordash', 'grubhub', 'fantuan', 'hungrypanda'],
        },
        maxItems: 5,
      },
      requires_approval: { type: 'boolean' },
    },
  };

  const prompt = [
    'You are RestaurantIQ Conversational Ops parser.',
    'Return light-touch normalization only, do not hallucinate unavailable items or platforms.',
    `User command: ${input}`,
    `Deterministic parse seed: ${JSON.stringify(parse)}`,
    `Menu items: ${deliveryState.menu.map((item) => item.name).join(' | ')}`,
    `Connected platforms: ${deriveConnectedPlatforms(deliveryState).join(', ')}`,
  ].join('\n');

  const llm = await runProviderJsonSchema<{
    normalized_intent: string;
    risk_level: RiskLevel;
    confidence: number;
    notes: string[];
    item_names?: string[];
    platform_keys?: DeliveryPlatformKey[];
    requires_approval?: boolean;
  }>({
    task: 'ops_intent_parse',
    prompt,
    schemaName: 'ops_intent_parse',
    schema,
    maxOutputTokens: 900,
    temperature: 0.1,
  });

  if (!llm.data) {
    if (llm.warning) parse.warnings.push(llm.warning);
    return parse;
  }

  const menuNames = new Map(deliveryState.menu.map((item) => [item.name.toLowerCase(), item]));
  const llmItemIds =
    llm.data.item_names
      ?.map((name) => menuNames.get(name.toLowerCase())?.id)
      .filter((id): id is string => Boolean(id)) ?? [];
  if (llmItemIds.length && !parse.targetItemIds.length) {
    parse.targetItemIds = Array.from(new Set(llmItemIds));
    parse.targetItemNames = parse.targetItemIds
      .map((id) => deliveryState.menu.find((item) => item.id === id)?.name || '')
      .filter(Boolean);
    parse.missingParams = parse.missingParams.filter((item) => item !== 'menu_item');
  }

  if (llm.data.platform_keys?.length) {
    parse.targetPlatforms = Array.from(new Set(llm.data.platform_keys));
  }

  parse.normalizedIntent = llm.data.normalized_intent || parse.normalizedIntent;
  parse.riskLevel = llm.data.risk_level || parse.riskLevel;
  parse.confidence = Math.max(parse.confidence, Math.min(0.99, llm.data.confidence || parse.confidence));
  if (Array.isArray(llm.data.notes)) {
    parse.notes.push(...llm.data.notes.slice(0, 4));
  }
  if (typeof llm.data.requires_approval === 'boolean' && llm.data.requires_approval) {
    parse.riskLevel = 'high';
  }
  return parse;
}

function parseInstructionDeterministically(
  input: string,
  deliveryState: DeliveryManagementState
): ParsedInstruction {
  const menu = deliveryState.menu;
  const connectedPlatforms = deriveConnectedPlatforms(deliveryState);
  const { matched, quoted } = findMentionedItems(input, menu);
  const actionDetection = detectPriceAction(input);
  const platforms = detectPlatforms(input, connectedPlatforms);
  const stores = detectStores(input);
  const schedule = detectSchedule(input);

  const parse: ParsedInstruction = {
    actionType: actionDetection.actionType,
    normalizedIntent: '',
    riskLevel: 'medium',
    confidence: matched.length ? 0.83 : quoted.length ? 0.74 : 0.66,
    discountMultiplier: actionDetection.discountMultiplier,
    priceDelta: actionDetection.priceDelta,
    targetItemIds: matched.map((item) => item.id),
    targetItemNames: matched.map((item) => item.name),
    targetPlatforms: platforms,
    targetStores: stores,
    scheduleAt: schedule.scheduleAt,
    autoRestoreAt: schedule.autoRestoreAt,
    missingParams: [],
    warnings: [],
    notes: [],
  };

  if ((parse.actionType === 'discount' || parse.actionType === 'price_adjust' || parse.actionType === 'unlist' || parse.actionType === 'relist') && !parse.targetItemIds.length) {
    parse.missingParams.push('menu_item');
  }
  if (!parse.targetPlatforms.length) parse.missingParams.push('platform');

  parse.riskLevel = calculateRiskLevel({
    actionType: parse.actionType,
    discountMultiplier: parse.discountMultiplier,
    priceDelta: parse.priceDelta,
    affectedItemCount: parse.targetItemIds.length,
    affectedPlatformCount: parse.targetPlatforms.length,
  });
  parse.normalizedIntent = buildNormalizedIntent(
    parse.actionType,
    parse.targetItemNames,
    parse.targetPlatforms,
    parse.targetStores
  );

  if (parse.missingParams.includes('menu_item')) {
    parse.warnings.push('No concrete menu item was recognized from the command.');
  }
  if (parse.actionType === 'generic') {
    parse.warnings.push('The instruction is generic. Manual edits may be required before execution.');
  }
  return parse;
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function buildExecutionPreview(
  parse: ParsedInstruction,
  deliveryState: DeliveryManagementState
): OpsExecutionPreview {
  const menuById = new Map(deliveryState.menu.map((item) => [item.id, item]));
  const changes: OpsExecutionChange[] = [];
  const riskNotes: string[] = [];

  const targetItems = parse.targetItemIds
    .map((id) => menuById.get(id))
    .filter((item): item is DeliveryMenuItem => Boolean(item));

  if (parse.actionType === 'discount' || parse.actionType === 'price_adjust') {
    for (const item of targetItems) {
      for (const platform of parse.targetPlatforms) {
        const channel = item.channels[platform];
        const oldPrice = channel?.price ?? item.basePrice;
        const newPrice =
          parse.actionType === 'discount'
            ? toMoney(oldPrice * (parse.discountMultiplier ?? 1))
            : toMoney(oldPrice + (parse.priceDelta ?? 0));
        changes.push({
          itemId: item.id,
          itemName: item.name,
          store: parse.targetStores[0] || 'Main Store',
          platform,
          field: 'price',
          oldValue: oldPrice,
          newValue: Math.max(0, newPrice),
          note:
            parse.actionType === 'discount'
              ? `discount ${Math.round((1 - (parse.discountMultiplier ?? 1)) * 100)}%`
              : `delta ${parse.priceDelta ?? 0}`,
        });
      }
    }
    if (!changes.length) {
      riskNotes.push('Price action has no resolvable item-channel target yet.');
    }
  } else if (parse.actionType === 'unlist' || parse.actionType === 'relist') {
    const nextAvailable = parse.actionType === 'relist';
    for (const item of targetItems) {
      for (const platform of parse.targetPlatforms) {
        const channel = item.channels[platform];
        changes.push({
          itemId: item.id,
          itemName: item.name,
          store: parse.targetStores[0] || 'Main Store',
          platform,
          field: 'availability',
          oldValue: channel?.enabled ?? item.available,
          newValue: nextAvailable,
        });
      }
    }
  } else if (parse.actionType === 'description_update' || parse.actionType === 'image_update') {
    for (const platform of parse.targetPlatforms) {
      changes.push({
        itemName: parse.targetItemNames.join(', ') || 'Selected menu set',
        store: parse.targetStores[0] || 'Main Store',
        platform,
        field: parse.actionType === 'description_update' ? 'description' : 'image',
        oldValue: 'current',
        newValue: 'updated',
      });
    }
  } else if (parse.actionType === 'threshold_adjust') {
    for (const platform of parse.targetPlatforms) {
      changes.push({
        itemName: 'Auto-accept threshold',
        store: parse.targetStores[0] || 'Main Store',
        platform,
        field: 'threshold',
        oldValue: 'current',
        newValue: 'adjusted',
      });
    }
  }

  const approvalRequired =
    parse.riskLevel === 'high' ||
    parse.actionType === 'threshold_adjust' ||
    parse.targetPlatforms.length > 2;

  if (approvalRequired) {
    riskNotes.push('High-risk or broad-scope change requires owner approval before execution.');
  }
  if (parse.scheduleAt) riskNotes.push('This command has a scheduled effective time.');
  if (parse.autoRestoreAt) riskNotes.push('Auto-restore has been configured.');

  const rollbackWindowMinutes: 1 | 3 | 5 =
    parse.riskLevel === 'high' ? 5 : parse.riskLevel === 'medium' ? 3 : 1;

  return {
    affectedStores: parse.targetStores,
    affectedPlatforms: parse.targetPlatforms,
    affectedItems: targetItems.map((item) => ({ id: item.id, name: item.name })),
    changes,
    effectiveAt: parse.scheduleAt,
    autoRestoreAt: parse.autoRestoreAt,
    riskNotes,
    approvalRequired,
    rollbackWindowMinutes,
    missingParams: parse.missingParams,
  };
}

function createAuditEntry({
  actorId,
  actorRole,
  action,
  fromStatus,
  toStatus,
  note,
}: {
  actorId: string;
  actorRole: OpsActorRole;
  action: OpsCommandAction | 'create' | 'auto_transition';
  fromStatus: OpsCommandStatus | null;
  toStatus: OpsCommandStatus;
  note?: string;
}) {
  return {
    id: randomUUID(),
    at: nowIso(),
    actorId,
    actorRole,
    action,
    fromStatus,
    toStatus,
    note,
  };
}

function updateCommandStatus(
  command: ConversationalOpsCommand,
  nextStatus: OpsCommandStatus,
  actorId: string,
  actorRole: OpsActorRole,
  action: OpsCommandAction | 'auto_transition',
  note?: string
) {
  if (command.status === nextStatus) return command;
  command.auditTrail.unshift(
    createAuditEntry({
      actorId,
      actorRole,
      action,
      fromStatus: command.status,
      toStatus: nextStatus,
      note,
    })
  );
  command.status = nextStatus;
  command.updatedAt = nowIso();
  return command;
}

function applyMenuChange(menu: DeliveryMenuItem[], change: OpsExecutionChange) {
  if (!change.itemId) return;
  const item = menu.find((entry) => entry.id === change.itemId);
  if (!item) return;

  if (change.field === 'price') {
    const price = typeof change.newValue === 'number' ? change.newValue : Number(change.newValue);
    if (!Number.isFinite(price)) return;
    item.channels[change.platform] = {
      enabled: true,
      price: Number(price.toFixed(2)),
    };
    return;
  }

  if (change.field === 'availability') {
    const enabled = Boolean(change.newValue);
    item.available = enabled;
    item.channels[change.platform] = {
      enabled,
      price: item.channels[change.platform]?.price ?? item.basePrice,
    };
  }
}

function snapshotBeforeExecution(menu: DeliveryMenuItem[], changes: OpsExecutionChange[]): OpsRollbackSnapshot[] {
  const ids = Array.from(new Set(changes.map((change) => change.itemId).filter((id): id is string => Boolean(id))));
  return ids
    .map((id) => {
      const item = menu.find((entry) => entry.id === id);
      if (!item) return null;
      return {
        itemId: id,
        before: structuredClone(item),
      } satisfies OpsRollbackSnapshot;
    })
    .filter((item): item is OpsRollbackSnapshot => Boolean(item));
}

function restoreFromSnapshot(menu: DeliveryMenuItem[], snapshot: OpsRollbackSnapshot[]) {
  for (const entry of snapshot) {
    const index = menu.findIndex((item) => item.id === entry.itemId);
    if (index === -1) continue;
    menu[index] = structuredClone(entry.before);
  }
}

const FINALIZED_STATUSES: OpsCommandStatus[] = [
  'completed',
  'rolled_back',
  'failed',
  'rejected',
];

const RETRY_BACKOFF_MINUTES = [1, 3, 10, 30];

function computeNextRetryAt(attemptNumber: number) {
  const minutes =
    RETRY_BACKOFF_MINUTES[Math.min(attemptNumber - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function upsertPlatformResult(command: ConversationalOpsCommand, result: OpsPlatformExecutionResult) {
  const existingIndex = command.platformResults.findIndex((row) => row.platform === result.platform);
  if (existingIndex >= 0) {
    command.platformResults[existingIndex] = result;
    return;
  }
  command.platformResults.push(result);
}

function commandRetryQueueSize(queueState: OpsRetryQueueState, commandId: string) {
  return queueState.jobs.filter((job) => job.commandId === commandId).length;
}

function removeCommandRetryJobs(queueState: OpsRetryQueueState, commandId: string) {
  const before = queueState.jobs.length;
  queueState.jobs = queueState.jobs.filter((job) => job.commandId !== commandId);
  return queueState.jobs.length !== before;
}

function ensureCommandPostRetryState(command: ConversationalOpsCommand) {
  if (FINALIZED_STATUSES.includes(command.status) || command.status === 'awaiting_approval') {
    return;
  }
  const successCount = command.platformResults.filter((row) => row.success).length;
  const failureCount = command.platformResults.filter((row) => !row.success).length;
  if (command.retryQueueSize && command.retryQueueSize > 0) {
    updateCommandStatus(
      command,
      'partially_failed',
      'system-retry',
      'internal',
      'auto_transition',
      'Retry queue still has pending jobs.'
    );
    return;
  }
  if (successCount > 0 && failureCount === 0) {
    updateCommandStatus(command, 'synced', 'system-retry', 'internal', 'auto_transition');
    updateCommandStatus(command, 'completed', 'system-retry', 'internal', 'auto_transition');
    return;
  }
  if (successCount > 0 && failureCount > 0) {
    updateCommandStatus(
      command,
      'partially_failed',
      'system-retry',
      'internal',
      'auto_transition',
      'Retry queue exhausted with partial success.'
    );
    return;
  }
  if (successCount === 0 && failureCount > 0) {
    updateCommandStatus(
      command,
      'failed',
      'system-retry',
      'internal',
      'auto_transition',
      'Retry queue exhausted with no successful platform sync.'
    );
  }
}

async function executeCommandNow({
  userKey,
  command,
  deliveryState,
  actorId,
  actorRole,
}: {
  userKey: string;
  command: ConversationalOpsCommand;
  deliveryState: DeliveryManagementState;
  actorId: string;
  actorRole: OpsActorRole;
}) {
  updateCommandStatus(command, 'executing', actorId, actorRole, 'execute');
  const queueState = await loadOpsRetryQueueState(userKey);
  removeCommandRetryJobs(queueState, command.id);
  const snapshot = snapshotBeforeExecution(deliveryState.menu, command.preview.changes);
  command.rollbackSnapshot = snapshot;
  command.platformResults = [];

  for (const platform of command.preview.affectedPlatforms) {
    const platformChanges = command.preview.changes.filter((change) => change.platform === platform);
    const outcome = await executePlatformChanges({
      userKey,
      commandId: command.id,
      platform,
      changes: platformChanges,
    });

    if (outcome.success) {
      for (const change of outcome.appliedChanges) {
        applyMenuChange(deliveryState.menu, change);
      }
      upsertPlatformResult(command, {
        platform,
        success: true,
        message: outcome.message,
        syncedAt: outcome.syncedAt,
        retryable: false,
      });
      continue;
    }

    if (outcome.retryable && platformChanges.length > 0) {
      const maxAttempts = Math.max(1, Number(process.env.OPS_RETRY_MAX_ATTEMPTS || '4'));
      const job: OpsRetryJob = {
        id: randomUUID(),
        commandId: command.id,
        platform,
        attempts: 1,
        maxAttempts,
        nextRunAt: computeNextRetryAt(1),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastError: outcome.message,
        changes: structuredClone(platformChanges),
      };
      queueState.jobs.unshift(job);
      upsertPlatformResult(command, {
        platform,
        success: false,
        message: `${outcome.message} Retry queued.`,
        syncedAt: nowIso(),
        retryable: true,
        attempts: job.attempts,
        nextRetryAt: job.nextRunAt,
      });
      continue;
    }

    upsertPlatformResult(command, {
      platform,
      success: false,
      message: outcome.message,
      syncedAt: nowIso(),
      retryable: false,
    });
  }

  command.retryQueueSize = commandRetryQueueSize(queueState, command.id);
  const successCount = command.platformResults.filter((row) => row.success).length;
  const failureCount = command.platformResults.filter((row) => !row.success).length;

  if (successCount > 0 && failureCount === 0) {
    updateCommandStatus(command, 'synced', actorId, actorRole, 'auto_transition');
    updateCommandStatus(command, 'completed', actorId, actorRole, 'auto_transition');
  } else if ((successCount > 0 && failureCount > 0) || (command.retryQueueSize ?? 0) > 0) {
    updateCommandStatus(command, 'partially_failed', actorId, actorRole, 'auto_transition');
  } else {
    updateCommandStatus(command, 'failed', actorId, actorRole, 'auto_transition');
  }

  if (successCount > 0) {
    const rollbackDeadline = new Date(Date.now() + command.preview.rollbackWindowMinutes * 60_000).toISOString();
    command.rollbackDeadline = rollbackDeadline;
  }

  command.updatedAt = nowIso();
  await saveOpsRetryQueueState(userKey, queueState);
}

function assertCommandTransition(
  command: ConversationalOpsCommand,
  action: OpsCommandAction,
  actorRole: OpsActorRole
) {
  if (!STATUS_ORDER.includes(command.status)) {
    return 'Unknown command status.';
  }

  if (action === 'approve' && !ROLE_CAN_APPROVE.includes(actorRole)) {
    return 'Only owner/internal roles can approve high-risk commands.';
  }
  if (action === 'rollback') {
    if (!command.rollbackDeadline) return 'Rollback is unavailable before execution succeeds.';
    if (Date.parse(command.rollbackDeadline) < Date.now()) return 'Rollback window has expired.';
  }
  if (action === 'approve' && command.status !== 'awaiting_approval') {
    return 'Command is not waiting for approval.';
  }
  if (action === 'confirm' && !['parsed', 'awaiting_confirmation'].includes(command.status)) {
    return 'Command cannot be confirmed in current status.';
  }
  if (action === 'execute' && ['completed', 'rolled_back', 'rejected', 'failed'].includes(command.status)) {
    return 'Command is already finalized.';
  }
  return null;
}

export async function createConversationalOpsCommand({
  sourceText,
  actorId,
  actorRole,
  deliveryState,
}: {
  sourceText: string;
  actorId: string;
  actorRole: OpsActorRole;
  deliveryState: DeliveryManagementState;
}) {
  const deterministic = parseInstructionDeterministically(sourceText, deliveryState);
  const parsed = await enrichParsedInstructionWithLlm(sourceText, deterministic, deliveryState);
  const preview = buildExecutionPreview(parsed, deliveryState);
  const requiresApproval = preview.approvalRequired || parsed.riskLevel === 'high';
  const status: OpsCommandStatus = 'awaiting_confirmation';
  const timestamp = nowIso();

  const command: ConversationalOpsCommand = {
    id: randomUUID(),
    sourceText,
    normalizedIntent: parsed.normalizedIntent,
    actionType: parsed.actionType,
    status,
    riskLevel: parsed.riskLevel,
    confidence: Math.max(0.4, Math.min(parsed.confidence, 0.99)),
    requiresApproval,
    scheduledAt: parsed.scheduleAt ?? undefined,
    autoRestoreAt: parsed.autoRestoreAt ?? undefined,
    preview,
    platformResults: [],
    missingParams: parsed.missingParams,
    warnings: Array.from(new Set([...parsed.warnings, ...parsed.notes])).slice(0, 8),
    createdAt: timestamp,
    updatedAt: timestamp,
    auditTrail: [
      createAuditEntry({
        actorId,
        actorRole,
        action: 'create',
        fromStatus: null,
        toStatus: status,
        note: parsed.missingParams.length
          ? `Missing params: ${parsed.missingParams.join(', ')}`
          : 'Command parsed and ready for confirmation.',
      }),
    ],
  };

  return command;
}

export function getCommandById(state: OpsCopilotState, commandId: string) {
  return state.commands.find((item) => item.id === commandId) || null;
}

export function listRecentCommands(state: OpsCopilotState, limit = 30) {
  return [...state.commands]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

export async function processDueOpsRetries({
  userKey,
  opsState,
  deliveryState,
}: {
  userKey: string;
  opsState: OpsCopilotState;
  deliveryState: DeliveryManagementState;
}): Promise<RetryQueueProcessingResult> {
  const queueState = await loadOpsRetryQueueState(userKey);
  if (!queueState.jobs.length) {
    return {
      opsState,
      deliveryState,
      queueChanged: false,
      processed: 0,
    };
  }

  const now = Date.now();
  let queueChanged = false;
  let processed = 0;
  const touchedCommands = new Set<string>();
  const remainingJobs: OpsRetryJob[] = [];

  for (const job of queueState.jobs) {
    const dueAt = Date.parse(job.nextRunAt);
    if (!Number.isFinite(dueAt) || dueAt > now) {
      remainingJobs.push(job);
      continue;
    }

    const command = getCommandById(opsState, job.commandId);
    if (!command || FINALIZED_STATUSES.includes(command.status)) {
      queueChanged = true;
      continue;
    }

    const outcome = await executePlatformChanges({
      userKey,
      commandId: job.commandId,
      platform: job.platform,
      changes: job.changes,
    });

    touchedCommands.add(command.id);
    processed += 1;
    queueChanged = true;

    if (outcome.success) {
      for (const change of job.changes) {
        applyMenuChange(deliveryState.menu, change);
      }
      upsertPlatformResult(command, {
        platform: job.platform,
        success: true,
        message: `Retry succeeded. ${outcome.message}`,
        syncedAt: outcome.syncedAt,
        retryable: false,
        attempts: job.attempts,
      });
      continue;
    }

    const nextAttempts = job.attempts + 1;
    if (outcome.retryable && nextAttempts <= job.maxAttempts) {
      const nextRetryAt = computeNextRetryAt(nextAttempts);
      remainingJobs.push({
        ...job,
        attempts: nextAttempts,
        nextRunAt: nextRetryAt,
        updatedAt: nowIso(),
        lastError: outcome.message,
      });
      upsertPlatformResult(command, {
        platform: job.platform,
        success: false,
        message: `${outcome.message} Retry scheduled.`,
        syncedAt: nowIso(),
        retryable: true,
        attempts: nextAttempts,
        nextRetryAt,
      });
      continue;
    }

    upsertPlatformResult(command, {
      platform: job.platform,
      success: false,
      message: `${outcome.message} Retry exhausted.`,
      syncedAt: nowIso(),
      retryable: false,
      attempts: nextAttempts,
    });
  }

  if (!queueChanged) {
    return {
      opsState,
      deliveryState,
      queueChanged: false,
      processed,
    };
  }

  queueState.jobs = remainingJobs;
  await saveOpsRetryQueueState(userKey, queueState);

  for (const commandId of touchedCommands) {
    const command = getCommandById(opsState, commandId);
    if (!command) continue;
    command.retryQueueSize = commandRetryQueueSize(queueState, command.id);
    ensureCommandPostRetryState(command);
    command.updatedAt = nowIso();
  }

  return {
    opsState: {
      ...opsState,
      updatedAt: nowIso(),
      commands: [...opsState.commands],
    },
    deliveryState: {
      ...deliveryState,
      updatedAt: nowIso(),
      menu: [...deliveryState.menu],
    },
    queueChanged: true,
    processed,
  };
}

export async function applyConversationalOpsAction({
  userKey,
  opsState,
  deliveryState,
  commandId,
  action,
  actorId,
  actorRole,
  scheduledAt,
  autoRestoreAt,
  note,
  force = false,
}: ActionInput): Promise<ApplyCommandResult> {
  const command = getCommandById(opsState, commandId);
  if (!command) {
    throw new Error('Command not found.');
  }

  const transitionError = assertCommandTransition(command, action, actorRole);
  if (transitionError) {
    throw new Error(transitionError);
  }

  if (action === 'confirm') {
    if (command.missingParams.length) {
      throw new Error(`Cannot confirm. Missing parameters: ${command.missingParams.join(', ')}`);
    }
    updateCommandStatus(command, 'parsed', actorId, actorRole, 'confirm', note);
    if (command.requiresApproval && !ROLE_CAN_APPROVE.includes(actorRole)) {
      updateCommandStatus(command, 'awaiting_approval', actorId, actorRole, 'auto_transition');
    } else if (command.scheduledAt && Date.parse(command.scheduledAt) > Date.now()) {
      updateCommandStatus(command, 'scheduled', actorId, actorRole, 'auto_transition');
    } else {
      await executeCommandNow({ userKey, command, deliveryState, actorId, actorRole });
    }
  } else if (action === 'approve') {
    command.approvedBy = actorId;
    command.approvedAt = nowIso();
    updateCommandStatus(command, 'parsed', actorId, actorRole, 'approve', note || 'Approval granted.');
    if (command.scheduledAt && Date.parse(command.scheduledAt) > Date.now() && !force) {
      updateCommandStatus(command, 'scheduled', actorId, actorRole, 'auto_transition');
    } else {
      await executeCommandNow({ userKey, command, deliveryState, actorId, actorRole });
    }
  } else if (action === 'schedule') {
    const normalizedSchedule = parseDateOrNull(scheduledAt);
    if (!normalizedSchedule) throw new Error('Invalid schedule time.');
    command.scheduledAt = normalizedSchedule;
    command.autoRestoreAt = parseDateOrNull(autoRestoreAt) ?? command.autoRestoreAt;
    command.preview.effectiveAt = command.scheduledAt ?? null;
    command.preview.autoRestoreAt = command.autoRestoreAt ?? null;
    updateCommandStatus(command, 'scheduled', actorId, actorRole, 'schedule', note);
  } else if (action === 'execute') {
    if (command.requiresApproval && !command.approvedBy && !ROLE_CAN_APPROVE.includes(actorRole)) {
      throw new Error('Approval is required before execution.');
    }
    if (command.scheduledAt && Date.parse(command.scheduledAt) > Date.now() && !force) {
      updateCommandStatus(command, 'scheduled', actorId, actorRole, 'execute', 'Execution deferred until schedule.');
    } else {
      await executeCommandNow({ userKey, command, deliveryState, actorId, actorRole });
    }
  } else if (action === 'rollback') {
    if (!command.rollbackSnapshot?.length) {
      throw new Error('No rollback snapshot found for this command.');
    }
    restoreFromSnapshot(deliveryState.menu, command.rollbackSnapshot);
    const queueState = await loadOpsRetryQueueState(userKey);
    if (removeCommandRetryJobs(queueState, command.id)) {
      await saveOpsRetryQueueState(userKey, queueState);
    }
    command.retryQueueSize = 0;
    updateCommandStatus(command, 'rolled_back', actorId, actorRole, 'rollback', note);
  } else if (action === 'reject') {
    updateCommandStatus(command, 'rejected', actorId, actorRole, 'reject', note || 'Rejected by reviewer.');
  }

  command.updatedAt = nowIso();
  const nextState: OpsCopilotState = {
    ...opsState,
    updatedAt: nowIso(),
    commands: opsState.commands.map((item) => (item.id === command.id ? command : item)),
  };

  return {
    opsState: nextState,
    deliveryState: {
      ...deliveryState,
      updatedAt: nowIso(),
    },
    command,
  };
}
