import type { DeliveryPlatformKey, DeliveryMenuItem } from '@/lib/delivery-management-types';
import type { RiskLevel } from '@/lib/types';

export type OpsActorRole = 'owner' | 'manager' | 'staff' | 'internal';

export type OpsCommandStatus =
  | 'draft'
  | 'parsed'
  | 'awaiting_confirmation'
  | 'awaiting_approval'
  | 'scheduled'
  | 'executing'
  | 'synced'
  | 'partially_failed'
  | 'rolled_back'
  | 'completed'
  | 'failed'
  | 'rejected';

export type OpsCommandActionType =
  | 'discount'
  | 'price_adjust'
  | 'unlist'
  | 'relist'
  | 'description_update'
  | 'image_update'
  | 'threshold_adjust'
  | 'generic';

export type OpsCommandAction =
  | 'confirm'
  | 'approve'
  | 'schedule'
  | 'execute'
  | 'rollback'
  | 'reject';

export type OpsExecutionChangeField =
  | 'price'
  | 'availability'
  | 'description'
  | 'image'
  | 'threshold';

export type OpsExecutionChange = {
  itemId?: string;
  itemName: string;
  store: string;
  platform: DeliveryPlatformKey;
  field: OpsExecutionChangeField;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  note?: string;
};

export type OpsExecutionPreview = {
  affectedStores: string[];
  affectedPlatforms: DeliveryPlatformKey[];
  affectedItems: Array<{ id: string; name: string }>;
  changes: OpsExecutionChange[];
  effectiveAt: string | null;
  autoRestoreAt: string | null;
  riskNotes: string[];
  approvalRequired: boolean;
  rollbackWindowMinutes: 1 | 3 | 5;
  missingParams: string[];
};

export type OpsPlatformExecutionResult = {
  platform: DeliveryPlatformKey;
  success: boolean;
  message: string;
  syncedAt: string;
  retryable?: boolean;
  attempts?: number;
  nextRetryAt?: string;
};

export type OpsRollbackSnapshot = {
  itemId: string;
  before: DeliveryMenuItem;
};

export type OpsAuditEntry = {
  id: string;
  at: string;
  actorId: string;
  actorRole: OpsActorRole;
  action: OpsCommandAction | 'create' | 'auto_transition';
  fromStatus: OpsCommandStatus | null;
  toStatus: OpsCommandStatus;
  note?: string;
};

export type ConversationalOpsCommand = {
  id: string;
  sourceText: string;
  normalizedIntent: string;
  actionType: OpsCommandActionType;
  status: OpsCommandStatus;
  riskLevel: RiskLevel;
  confidence: number;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  scheduledAt?: string;
  autoRestoreAt?: string;
  rollbackDeadline?: string;
  rollbackSnapshot?: OpsRollbackSnapshot[];
  preview: OpsExecutionPreview;
  platformResults: OpsPlatformExecutionResult[];
  retryQueueSize?: number;
  missingParams: string[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  auditTrail: OpsAuditEntry[];
};

export type OpsCopilotState = {
  updatedAt: string;
  commands: ConversationalOpsCommand[];
};
