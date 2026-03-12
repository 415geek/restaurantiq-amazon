import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OpsCopilotState } from '@/lib/ops-copilot-types';

const runtimeDir = path.join(process.cwd(), '.runtime', 'ops-copilot');

function sanitizeUserKey(userKey: string) {
  return userKey.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function runtimePath(userKey: string) {
  return path.join(runtimeDir, `${sanitizeUserKey(userKey)}.json`);
}

async function ensureRuntimeDir() {
  await mkdir(runtimeDir, { recursive: true });
}

export function createDefaultOpsCopilotState(): OpsCopilotState {
  return {
    updatedAt: new Date().toISOString(),
    commands: [],
  };
}

export async function loadOpsCopilotState(userKey: string): Promise<OpsCopilotState> {
  try {
    const raw = await readFile(runtimePath(userKey), 'utf8');
    const parsed = JSON.parse(raw) as OpsCopilotState;
    return {
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      commands: Array.isArray(parsed.commands) ? parsed.commands : [],
    };
  } catch {
    return createDefaultOpsCopilotState();
  }
}

export async function saveOpsCopilotState(userKey: string, state: OpsCopilotState) {
  await ensureRuntimeDir();
  const next: OpsCopilotState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(runtimePath(userKey), JSON.stringify(next, null, 2), 'utf8');
  return next;
}
