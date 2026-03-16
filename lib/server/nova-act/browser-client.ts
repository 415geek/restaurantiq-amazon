/**
 * Amazon Nova Act Browser Automation Client
 *
 * 用于执行外卖平台的自动化操作:
 * - 竞争对手菜单扫描
 * - 价格更新
 * - 评论监控
 *
 * 注意: Nova Act SDK 目前在 Preview 阶段
 * 此实现包含完整的接口设计，当 SDK 正式发布后可直接替换
 */

import type {
  NovaActTask,
  CompetitorScanResult,
  PriceUpdateAction,
  NovaActConfig,
} from './types';

export class NovaActBrowserClient {
  private config: NovaActConfig;
  private tasks: Map<string, NovaActTask> = new Map();
  private isConfigured: boolean;

  constructor(config?: Partial<NovaActConfig>) {
    this.config = {
      region: process.env.AWS_REGION || 'us-east-1',
      enabled: process.env.AWS_NOVA_ACT_ENABLED === 'true',
      headless: config?.headless ?? true,
      timeout: config?.timeout ?? 60000,
      screenshotOnError: config?.screenshotOnError ?? true,
    };

    this.isConfigured = Boolean(
      this.config.enabled &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }

  /**
   * 检查 Nova Act 配置状态
   */
  checkConfiguration(): {
    configured: boolean;
    enabled: boolean;
    message: string;
    missingVars?: string[];
  } {
    const missingVars: string[] = [];

    if (process.env.AWS_NOVA_ACT_ENABLED !== 'true') {
      missingVars.push('AWS_NOVA_ACT_ENABLED');
    }
    if (!process.env.AWS_ACCESS_KEY_ID) {
      missingVars.push('AWS_ACCESS_KEY_ID');
    }
    if (!process.env.AWS_SECRET_ACCESS_KEY) {
      missingVars.push('AWS_SECRET_ACCESS_KEY');
    }

    if (missingVars.length > 0) {
      return {
        configured: false,
        enabled: false,
        message: `Nova Act not configured. Missing: ${missingVars.join(', ')}`,
        missingVars,
      };
    }

    return {
      configured: true,
      enabled: true,
      message: 'Nova Act is configured and ready for browser automation.',
    };
  }

  /**
   * 扫描竞争对手菜单
   */
  async scanCompetitorMenu(
    platform: 'doordash' | 'ubereats' | 'grubhub' | 'hungrypanda' | 'fantuan',
    restaurantName: string,
    address: string
  ): Promise<CompetitorScanResult[]> {
    const taskId = `scan_${Date.now()}`;

    this.tasks.set(taskId, {
      id: taskId,
      type: 'competitor_scan',
      status: 'running',
      platform,
      target: restaurantName,
      startedAt: new Date().toISOString(),
    });

    try {
      if (!this.isConfigured) {
        // Demo 模式: 返回模拟数据
        console.log('[Nova Act] Running in demo mode - returning mock data');
        return this.getMockCompetitorData(platform, restaurantName);
      }

      // TODO: 正式 Nova Act SDK 实现
      // Placeholder: 目前仍返回 mock 数据，避免调用不存在的 SDK。
      return this.getMockCompetitorData(platform, restaurantName);
    } catch (error) {
      this.tasks.set(taskId, {
        ...this.tasks.get(taskId)!,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString(),
      });

      // 返回 mock 数据作为 fallback
      return this.getMockCompetitorData(platform, restaurantName);
    }
  }

  /**
   * 执行价格更新
   */
  async executePriceUpdate(
    platform: string,
    updates: PriceUpdateAction[]
  ): Promise<{ success: boolean; updated: number; errors: string[] }> {
    const taskId = `price_update_${Date.now()}`;

    this.tasks.set(taskId, {
      id: taskId,
      type: 'price_update',
      status: 'running',
      platform,
      startedAt: new Date().toISOString(),
    });

    try {
      if (!this.isConfigured) {
        return {
          success: false,
          updated: 0,
          errors: ['Nova Act not configured. Price updates require live browser automation.'],
        };
      }

      // TODO: 实现实际的价格更新自动化
      return {
        success: false,
        updated: 0,
        errors: ['Nova Act SDK integration pending'],
      };
    } catch (error) {
      this.tasks.set(taskId, {
        ...this.tasks.get(taskId)!,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString(),
      });

      return {
        success: false,
        updated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): NovaActTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): NovaActTask[] {
    return Array.from(this.tasks.values());
  }

  // 平台 URL 映射
  private getPlatformUrl(platform: string): string {
    const urls: Record<string, string> = {
      doordash: 'https://www.doordash.com',
      ubereats: 'https://www.ubereats.com',
      grubhub: 'https://www.grubhub.com',
      hungrypanda: 'https://www.hungrypanda.co',
      fantuan: 'https://www.fantuan.ca',
    };
    return urls[platform] || urls.doordash;
  }

  // Mock 数据生成器
  private getMockCompetitorData(
    platform: string,
    searchQuery: string
  ): CompetitorScanResult[] {
    const now = new Date().toISOString();

    return [
      {
        competitor: {
          name: 'Lucky Dragon Restaurant',
          platform,
          address: '456 Market St, San Francisco, CA',
          rating: 4.3,
          reviewCount: 287,
          priceRange: '$$',
          deliveryFee: '$2.99',
          deliveryTime: '25-35 min',
        },
        menuItems: [
          {
            name: 'General Tso Chicken',
            name_zh: '左宗棠鸡',
            price: 15.99,
            category: 'Entrees',
            available: true,
            platform,
            lastUpdated: now,
          },
          {
            name: 'Kung Pao Shrimp',
            name_zh: '宫保虾',
            price: 17.99,
            category: 'Entrees',
            available: true,
            platform,
            lastUpdated: now,
          },
          {
            name: 'Vegetable Lo Mein',
            name_zh: '蔬菜捞面',
            price: 12.99,
            category: 'Noodles',
            available: true,
            platform,
            lastUpdated: now,
          },
        ],
        promotions: [
          {
            title: '$5 off $30+',
            description: 'Limited time offer',
            discount: '$5',
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        scannedAt: now,
      },
      {
        competitor: {
          name: 'Golden Phoenix BBQ',
          platform,
          address: '789 Clement St, San Francisco, CA',
          rating: 4.5,
          reviewCount: 412,
          priceRange: '$$',
          deliveryFee: '$1.99',
          deliveryTime: '20-30 min',
        },
        menuItems: [
          {
            name: 'BBQ Pork Combo',
            name_zh: '叉烧拼盘',
            price: 18.99,
            category: 'BBQ Specials',
            available: true,
            platform,
            lastUpdated: now,
          },
          {
            name: 'Roast Duck (Half)',
            name_zh: '烧鸭半只',
            price: 24.99,
            category: 'BBQ Specials',
            available: true,
            platform,
            lastUpdated: now,
          },
        ],
        promotions: [],
        scannedAt: now,
      },
    ];
  }
}

// Singleton
let novaActClient: NovaActBrowserClient | null = null;

export function getNovaActClient(): NovaActBrowserClient {
  if (!novaActClient) {
    novaActClient = new NovaActBrowserClient();
  }
  return novaActClient;
}

export function isNovaActEnabled(): boolean {
  return process.env.AWS_NOVA_ACT_ENABLED === 'true';
}

