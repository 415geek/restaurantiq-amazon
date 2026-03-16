/**
 * Integration Token Store
 *
 * 注意: 这是简化版本，生产环境应使用加密数据库存储
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const STORE_PATH = path.join(process.cwd(), '.runtime', 'integrations.json');

interface IntegrationTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  storeId?: string;
}

interface IntegrationStore {
  [key: string]: IntegrationTokens;
}

async function ensureStoreExists(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  } catch {
    // Directory exists
  }
}

async function readStore(): Promise<IntegrationStore> {
  try {
    const data = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(data) as IntegrationStore;
  } catch {
    return {};
  }
}

async function writeStore(store: IntegrationStore): Promise<void> {
  await ensureStoreExists();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

export async function saveIntegrationTokens(integration: string, tokens: IntegrationTokens): Promise<void> {
  const store = await readStore();
  store[integration] = tokens;
  await writeStore(store);
}

export async function getIntegrationTokens(integration: string): Promise<IntegrationTokens | null> {
  const store = await readStore();
  return store[integration] || null;
}

export async function deleteIntegrationTokens(integration: string): Promise<void> {
  const store = await readStore();
  delete store[integration];
  await writeStore(store);
}

export async function isIntegrationConnected(integration: string): Promise<boolean> {
  const tokens = await getIntegrationTokens(integration);
  if (!tokens?.accessToken) return false;

  // 检查是否过期
  if (tokens.expiresAt) {
    const expiresAt = new Date(tokens.expiresAt);
    if (expiresAt < new Date()) return false;
  }

  return true;
}

