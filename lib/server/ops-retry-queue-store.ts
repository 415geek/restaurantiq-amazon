import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DeliveryPlatformKey } from '@/lib/delivery-management-types';
import type { OpsExecutionChange } from '@/lib/ops-copilot-types';

export type OpsRetryJob = {
  id: string;
  commandId: string;
  platform: DeliveryPlatformKey;
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  changes: OpsExecutionChange[];
};

export type OpsRetryQueueState = {
  updatedAt: string;
  jobs: OpsRetryJob[];
};

const runtimeDir = path.join(process.cwd(), '.runtime', 'ops-retry-queue');

function nowIso() {
  return new Date().toISOString();
}

function sanitizeUserKey(userKey: string) {
  return userKey.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function runtimePath(userKey: string) {
  return path.join(runtimeDir, `${sanitizeUserKey(userKey)}.json`);
}

async function ensureRuntimeDir() {
  await mkdir(runtimeDir, { recursive: true });
}

function createDefaultState(): OpsRetryQueueState {
  return {
    updatedAt: nowIso(),
    jobs: [],
  };
}

export async function loadOpsRetryQueueState(userKey: string): Promise<OpsRetryQueueState> {
  try {
    const raw = await readFile(runtimePath(userKey), 'utf8');
    const parsed = JSON.parse(raw) as OpsRetryQueueState;
    return {
      updatedAt: parsed.updatedAt || nowIso(),
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  } catch {
    return createDefaultState();
  }
}

export async function saveOpsRetryQueueState(userKey: string, state: OpsRetryQueueState) {
  await ensureRuntimeDir();
  const nextState: OpsRetryQueueState = {
    ...state,
    updatedAt: nowIso(),
  };
  await writeFile(runtimePath(userKey), JSON.stringify(nextState, null, 2), 'utf8');
  return nextState;
}

