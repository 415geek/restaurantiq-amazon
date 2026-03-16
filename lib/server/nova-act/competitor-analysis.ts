import { getNovaActClient } from './browser-client';
import { generateNovaCompletion } from '@/lib/server/aws-nova-client';
import type { CompetitorScanResult, PriceUpdateAction } from './types';

interface PricingRecommendation {
  itemName: string;
  currentPrice: number;
  recommendedPrice: number;
  competitorAvgPrice: number;
  pricePosition: 'below_market' | 'at_market' | 'above_market';
  confidence: number;
  rationale: string;
  rationale_zh: string;
}

const PRICING_PROMPT = `You are a restaurant pricing analyst. Based on competitor menu data, suggest pricing optimizations.

IMPORTANT: Return ONLY valid JSON, no other text.

Format:
{
  "recommendations": [
    {
      "itemName": "Item Name",
      "currentPrice": 12.99,
      "recommendedPrice": 13.99,
      "competitorAvgPrice": 14.50,
      "pricePosition": "below_market",
      "confidence": 0.85,
      "rationale": "English reason",
      "rationale_zh": "中文原因"
    }
  ],
  "summary": "English summary",
  "summary_zh": "中文总结"
}

Current menu items:
`;

export class CompetitorAnalysisService {
  private novaActClient = getNovaActClient();

  /**
   * 执行完整的竞争分析流程
   */
  async runFullAnalysis(
    myMenu: Array<{ name: string; price: number; category: string }>,
    platforms: string[] = ['doordash', 'ubereats'],
    location: string
  ): Promise<{
    competitorData: CompetitorScanResult[];
    recommendations: PricingRecommendation[];
    summary: string;
    summary_zh: string;
    actions: PriceUpdateAction[];
  }> {
    // Step 1: 扫描所有平台的竞争对手
    const allCompetitorData: CompetitorScanResult[] = [];

    for (const platform of platforms) {
      const results = await this.novaActClient.scanCompetitorMenu(
        platform as any,
        'chinese restaurant',
        location
      );
      allCompetitorData.push(...results);
    }

    // Step 2: 使用 Nova LLM 分析定价
    const recommendations = await this.generatePricingRecommendations(myMenu, allCompetitorData);

    // Step 3: 生成可执行的价格更新动作
    const actions = recommendations.recommendations
      .filter(
        (r) => r.confidence > 0.7 && Math.abs(r.recommendedPrice - r.currentPrice) >= 0.5
      )
      .map((r) => ({
        platform: 'all',
        itemId: r.itemName.toLowerCase().replace(/\s+/g, '_'),
        itemName: r.itemName,
        currentPrice: r.currentPrice,
        newPrice: r.recommendedPrice,
        reason: r.rationale,
        confidence: r.confidence,
        requiresApproval:
          r.confidence < 0.9 || Math.abs(r.recommendedPrice - r.currentPrice) > 2,
      }));

    return {
      competitorData: allCompetitorData,
      recommendations: recommendations.recommendations,
      summary: recommendations.summary,
      summary_zh: recommendations.summary_zh,
      actions,
    };
  }

  /**
   * 使用 Nova LLM 生成定价建议
   */
  private async generatePricingRecommendations(
    myMenu: Array<{ name: string; price: number; category: string }>,
    competitorData: CompetitorScanResult[]
  ): Promise<{
    recommendations: PricingRecommendation[];
    summary: string;
    summary_zh: string;
  }> {
    // 整理竞争对手价格数据
    const competitorPrices: Record<string, number[]> = {};

    competitorData.forEach((comp) => {
      comp.menuItems.forEach((item) => {
        const key = item.name.toLowerCase();
        if (!competitorPrices[key]) competitorPrices[key] = [];
        competitorPrices[key].push(item.price);
      });
    });

    // 计算平均价格
    const avgPrices: Record<string, number> = {};
    Object.entries(competitorPrices).forEach(([key, prices]) => {
      avgPrices[key] = prices.reduce((a, b) => a + b, 0) / prices.length;
    });

    const prompt = PRICING_PROMPT + JSON.stringify({
      myMenu,
      competitorAveragePrices: avgPrices,
      totalCompetitorsScanned: competitorData.length,
    });

    try {
      const response = await generateNovaCompletion(prompt, {
        model: 'amazon.nova-pro-v1:0',
        temperature: 0.2,
        maxTokens: 2000,
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }

      return JSON.parse(jsonMatch[0]) as {
        recommendations: PricingRecommendation[];
        summary: string;
        summary_zh: string;
      };
    } catch {
      // Fallback: 基于规则的简单建议
      return {
        recommendations: myMenu.map((item) => {
          const key = item.name.toLowerCase();
          const avgPrice = avgPrices[key] || item.price;
          const diff = avgPrice - item.price;

          return {
            itemName: item.name,
            currentPrice: item.price,
            recommendedPrice: diff > 1 ? item.price + 0.5 : item.price,
            competitorAvgPrice: avgPrice,
            pricePosition:
              diff > 1
                ? ('below_market' as const)
                : diff < -1
                  ? ('above_market' as const)
                  : ('at_market' as const),
            confidence: 0.6,
            rationale: diff > 1 ? 'Price is below market average' : 'Price is competitive',
            rationale_zh: diff > 1 ? '价格低于市场平均' : '价格具有竞争力',
          };
        }),
        summary: 'Pricing analysis completed with limited data.',
        summary_zh: '定价分析完成，数据有限。',
      };
    }
  }
}

export function createCompetitorAnalysisService(): CompetitorAnalysisService {
  return new CompetitorAnalysisService();
}

