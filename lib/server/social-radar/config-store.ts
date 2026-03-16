import fs from 'node:fs/promises';
import path from 'node:path';
import type { SocialRadarConfig } from './types';

const CONFIG_PATH = path.join(process.cwd(), '.runtime', 'social-radar-config.json');

export async function loadSocialRadarConfig(): Promise<SocialRadarConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data) as SocialRadarConfig;
  } catch {
    return {
      alertThreshold: 3,
    };
  }
}

export async function saveSocialRadarConfig(config: SocialRadarConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

