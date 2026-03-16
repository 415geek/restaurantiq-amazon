export interface NovaActScanResult {
  source: 'nova_act' | 'nova_llm' | 'fallback';
  competitors: Array<{
    name: string;
    platform: string;
    rating?: number;
    reviewCount?: number;
    priceRange?: string;
    topItems: Array<{ name: string; price: number }>;
  }>;
  summary: string;
  warnings: string[];
}

export async function runNovaActCompetitorScan(params: {
  query: string;
  address: string;
  platform: string;
}): Promise<NovaActScanResult> {
  // SDK 版本暂未安装，这里统一退回 LLM / fallback 逻辑
  return {
    source: 'fallback',
    competitors: [],
    summary: '',
    warnings: ['@aws-sdk/client-nova-act not installed; real Nova Act workflow is disabled.'],
  };
}

export function isNovaActConfigured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}
