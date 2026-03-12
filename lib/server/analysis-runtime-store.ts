import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnalysisRuntimeState } from '@/lib/analysis-runtime-state';

const runtimeDir = path.join(process.cwd(), '.runtime', 'analysis');

function sanitizeUserKey(userKey: string) {
  return userKey.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function runtimePathForUser(userKey: string) {
  return path.join(runtimeDir, `${sanitizeUserKey(userKey)}.json`);
}

async function ensureRuntimeDir() {
  await mkdir(runtimeDir, { recursive: true });
}

export async function loadPersistedAnalysisRuntimeState(userKey: string): Promise<AnalysisRuntimeState | null> {
  try {
    const raw = await readFile(runtimePathForUser(userKey), 'utf8');
    return JSON.parse(raw) as AnalysisRuntimeState;
  } catch {
    return null;
  }
}

export async function savePersistedAnalysisRuntimeState(userKey: string, state: AnalysisRuntimeState) {
  await ensureRuntimeDir();
  const next: AnalysisRuntimeState = {
    ...state,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
  await writeFile(runtimePathForUser(userKey), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export async function clearPersistedAnalysisRuntimeState(userKey: string) {
  try {
    await rm(runtimePathForUser(userKey), { force: true });
  } catch {
    return;
  }
}
