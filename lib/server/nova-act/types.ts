export interface NovaActTask {
  id: string;
  type: 'competitor_scan' | 'price_update' | 'menu_sync' | 'review_monitor';
  status: 'pending' | 'running' | 'completed' | 'failed';
  platform: string;
  target?: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  screenshots?: string[];
}

export interface CompetitorMenuItem {
  name: string;
  name_zh?: string;
  price: number;
  originalPrice?: number;
  category: string;
  description?: string;
  image?: string;
  available: boolean;
  platform: string;
  lastUpdated: string;
}

export interface CompetitorScanResult {
  competitor: {
    name: string;
    platform: string;
    address?: string;
    rating?: number;
    reviewCount?: number;
    priceRange?: string;
    deliveryFee?: string;
    deliveryTime?: string;
  };
  menuItems: CompetitorMenuItem[];
  promotions: Array<{
    title: string;
    description: string;
    discount?: string;
    validUntil?: string;
  }>;
  scannedAt: string;
}

export interface PriceUpdateAction {
  platform: string;
  itemId: string;
  itemName: string;
  currentPrice: number;
  newPrice: number;
  reason: string;
  confidence: number;
  requiresApproval: boolean;
}

export interface NovaActConfig {
  region: string;
  enabled: boolean;
  headless: boolean;
  timeout: number;
  screenshotOnError: boolean;
}

