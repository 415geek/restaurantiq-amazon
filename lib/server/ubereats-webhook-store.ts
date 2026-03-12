import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type UberEatsWebhookEventRecord = {
  id: string;
  receivedAt: string;
  topic?: string;
  eventType?: string;
  storeId?: string;
  payload: unknown;
};

const runtimeDir = path.join(process.cwd(), '.runtime', 'ubereats');
const runtimeFile = path.join(runtimeDir, 'webhook-events.json');
const MAX_EVENTS = 300;

async function ensureDir() {
  await mkdir(runtimeDir, { recursive: true });
}

async function readEvents() {
  try {
    const raw = await readFile(runtimeFile, 'utf8');
    const parsed = JSON.parse(raw) as UberEatsWebhookEventRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendUberEatsWebhookEvent(event: UberEatsWebhookEventRecord) {
  await ensureDir();
  const existing = await readEvents();
  const next = [event, ...existing].slice(0, MAX_EVENTS);
  await writeFile(runtimeFile, JSON.stringify(next, null, 2), 'utf8');
  return event;
}

export async function listUberEatsWebhookEvents(limit = 30) {
  const events = await readEvents();
  return events.slice(0, Math.max(1, Math.min(200, limit)));
}
