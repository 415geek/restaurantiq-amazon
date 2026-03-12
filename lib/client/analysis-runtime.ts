import type {
  AgentAMonthlyTrendPoint,
  AnalysisResponse,
  AgentMetric,
  ExecutionPlanPreview,
  Recommendation,
  UploadedOpsDocument,
} from '@/lib/types';
import type { AnalysisRuntimeState } from '@/lib/analysis-runtime-state';
import { dashboardMetrics, mockAnalysisResponse } from '@/lib/mock-data';

const ANALYSIS_RUNTIME_STORAGE_KEY = 'restaurant_iq_analysis_runtime_v2';

export type PlatformDistributionItem = {
  label: string;
  orders: number;
  revenue: number;
  sharePct: number;
};

export type DashboardInsightSnapshot = {
  healthScore: number;
  healthGrade: string;
  healthIssue: string;
  healthStrength: string;
  monthlyTrend: AgentAMonthlyTrendPoint[];
  platformDistribution: PlatformDistributionItem[];
  warning?: string;
  source: AnalysisResponse['source'];
  priorityRecommendation?: Recommendation;
  recommendationStats: {
    total: number;
    highImpact: number;
    humanReviewRequired: number;
  };
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function loadAnalysisRuntimeState(): AnalysisRuntimeState | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(ANALYSIS_RUNTIME_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalysisRuntimeState;
  } catch {
    return null;
  }
}

export function saveAnalysisRuntimeState(state: AnalysisRuntimeState) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(ANALYSIS_RUNTIME_STORAGE_KEY, JSON.stringify(state));
}

export function clearAnalysisRuntimeState() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(ANALYSIS_RUNTIME_STORAGE_KEY);
}

export async function fetchAnalysisRuntimeState(): Promise<AnalysisRuntimeState | null> {
  try {
    const response = await fetch('/api/analysis/runtime', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AnalysisRuntimeState;
  } catch {
    return null;
  }
}

export async function deleteAnalysisRuntimeState() {
  try {
    await fetch('/api/analysis/runtime', {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    return;
  }
}

function formatCurrency(value: number, lang: 'zh' | 'en') {
  return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatCompactCurrency(value: number, lang: 'zh' | 'en') {
  return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number, lang: 'zh' | 'en', digits = 1) {
  return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatInteger(value: number, lang: 'zh' | 'en') {
  return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function percentDelta(current: number | null | undefined, baseline: number | null | undefined) {
  if (!current || !baseline || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function pickOperationalBaseline(points: AgentAMonthlyTrendPoint[]) {
  return points.find((point) => point.revenue >= 10000 || point.orders >= 100) ?? points[0];
}

function getRecommendationStats(
  recommendations: Recommendation[],
  executionPlansPreview: ExecutionPlanPreview[] | undefined
) {
  return {
    total: recommendations.length,
    highImpact: recommendations.filter((item) => item.impact_score >= 8).length,
    humanReviewRequired:
      executionPlansPreview?.filter((item) => item.requiresHumanConfirmation).length
      ?? recommendations.filter((item) => item.risk_level === 'high' || item.risk_level === 'medium')
        .length,
  };
}

function derivePlatformDistribution(analysis: AnalysisResponse): PlatformDistributionItem[] {
  const entries = Object.entries(analysis.agentAParsed?.platform_breakdown ?? {});
  return entries
    .map(([label, value]) => ({
      label,
      orders: value.orders,
      revenue: value.revenue,
      sharePct: value.share_pct,
    }))
    .filter((item) => item.orders > 0 || item.revenue > 0 || item.sharePct > 0)
    .sort((left, right) => right.revenue - left.revenue || right.orders - left.orders)
    .slice(0, 6);
}

function deriveHealthSnapshot(
  analysis: AnalysisResponse
): Pick<DashboardInsightSnapshot, 'healthScore' | 'healthGrade' | 'healthIssue' | 'healthStrength'> {
  const overview = analysis.agentAParsed?.overview;
  const monthlyTrend = analysis.agentAParsed?.monthly_trend ?? [];
  const baseline = monthlyTrend.length ? pickOperationalBaseline(monthlyTrend) : null;
  const latest = monthlyTrend.at(-1) ?? null;
  const peakDiscountMonth = [...monthlyTrend].sort((left, right) => right.discountRate - left.discountRate)[0];
  const stableAov =
    overview?.avg_order_value !== null
    && overview?.avg_order_value !== undefined
    && overview.avg_order_value >= 40
    && overview.avg_order_value <= 55;
  const discountHealthy =
    overview?.discount_rate !== null
    && overview?.discount_rate !== undefined
    && overview.discount_rate >= 5
    && overview.discount_rate <= 8.5;
  const orderGrowthPct = percentDelta(latest?.dailyOrders, baseline?.dailyOrders);

  let score = 72;
  if (orderGrowthPct && orderGrowthPct > 30) score += 8;
  if (stableAov) score += 6;
  if (discountHealthy) score += 4;
  if ((peakDiscountMonth?.discountRate ?? 0) >= 10) score -= 8;
  if ((analysis.recommendations[0]?.risk_level ?? 'low') === 'high') score -= 4;
  score = Math.max(45, Math.min(96, Math.round(score)));

  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  const gradeZhMap = {
    A: '优',
    B: '良好',
    C: '中等',
    D: '偏弱',
    F: '危险',
  } as const;

  return {
    healthScore: score,
    healthGrade: `${grade} · ${gradeZhMap[grade]}`,
    healthIssue:
      peakDiscountMonth && peakDiscountMonth.discountRate >= 10
        ? `${peakDiscountMonth.monthLabel}折扣率偏高（${formatNumber(peakDiscountMonth.discountRate, 'zh', 1)}%）`
        : '暂无明显异常月度折扣风险',
    healthStrength:
      orderGrowthPct && orderGrowthPct > 30
        ? `客单价稳定，订单量较基准月提升 ${formatInteger(Math.round(orderGrowthPct), 'zh')}%`
        : '客单价表现稳定，营收结构健康',
  };
}

export function deriveDashboardMetrics(
  lang: 'zh' | 'en',
  analysis: AnalysisResponse,
  _updatedAt: string | null,
  _uploadedDocuments: UploadedOpsDocument[] = []
): AgentMetric[] {
  const overview = analysis.agentAParsed?.overview;
  const monthlyTrend = analysis.agentAParsed?.monthly_trend ?? [];
  const baseline = monthlyTrend.length ? pickOperationalBaseline(monthlyTrend) : null;
  const latest = monthlyTrend.at(-1) ?? null;
  const peakOrders = [...monthlyTrend].sort((left, right) => right.dailyOrders - left.dailyOrders)[0];
  const orderGrowthPct = percentDelta(overview?.daily_orders, baseline?.dailyOrders);
  const revenueGrowthPct = percentDelta(latest?.revenue, baseline?.revenue);

  if (!overview || monthlyTrend.length === 0) {
    return dashboardMetrics;
  }

  return [
    {
      id: 'total-revenue',
      title: lang === 'zh' ? '总营收' : 'Total Revenue',
      titleEn: lang === 'zh' ? 'Total Revenue' : undefined,
      value: formatCompactCurrency(overview.total_revenue ?? 0, lang),
      trend:
        revenueGrowthPct !== null
          ? `${lang === 'zh' ? '↑' : '+'} ${formatInteger(Math.round(Math.abs(revenueGrowthPct)), lang)}% ${lang === 'zh' ? `vs ${baseline?.monthLabel ?? ''}` : `vs ${baseline?.monthLabelEn ?? ''}`}`.trim()
          : lang === 'zh'
            ? '6个月累计'
            : '6-month total',
      trendDirection: revenueGrowthPct !== null && revenueGrowthPct > 0 ? 'up' : 'flat',
      subtitle:
        lang === 'zh'
          ? `6个月累计 · 峰值 ${peakOrders?.monthLabel ?? '--'}`
          : `6-month cumulative · Peak ${peakOrders?.monthLabelEn ?? '--'}`,
      tone: 'good',
    },
    {
      id: 'avg-order-value',
      title: lang === 'zh' ? '平均客单价' : 'Avg Order Value',
      titleEn: lang === 'zh' ? 'Avg Order Value' : undefined,
      value: formatCurrency(overview.avg_order_value ?? 0, lang),
      trend: lang === 'zh' ? '→ 稳定' : '→ Stable',
      trendDirection: 'flat',
      subtitle: lang === 'zh' ? '行业基准 $50' : 'Industry benchmark $50',
      tone: 'good',
    },
    {
      id: 'daily-orders',
      title: lang === 'zh' ? '日均订单' : 'Daily Orders',
      titleEn: lang === 'zh' ? 'Daily Orders' : undefined,
      value: formatNumber(overview.daily_orders ?? 0, lang, 1),
      trend:
        orderGrowthPct !== null
          ? `${lang === 'zh' ? '↑' : '+'} ${formatInteger(Math.round(Math.abs(orderGrowthPct)), lang)}% ${lang === 'zh' ? `vs ${baseline?.monthLabel ?? ''}` : `vs ${baseline?.monthLabelEn ?? ''}`}`.trim()
          : '--',
      trendDirection: orderGrowthPct !== null && orderGrowthPct > 0 ? 'up' : 'flat',
      subtitle:
        peakOrders
          ? lang === 'zh'
            ? `${peakOrders.monthLabel}最高 ${formatNumber(peakOrders.dailyOrders, lang, 1)}`
            : `${peakOrders.monthLabelEn} peak ${formatNumber(peakOrders.dailyOrders, lang, 1)}`
          : '--',
      tone: 'good',
    },
    {
      id: 'discount-rate',
      title: lang === 'zh' ? '折扣率' : 'Discount Rate',
      titleEn: lang === 'zh' ? 'Discount Rate' : undefined,
      value: `${formatNumber(overview.discount_rate ?? 0, lang, 1)}%`,
      trend:
        (overview.discount_rate ?? 0) >= 5 && (overview.discount_rate ?? 0) <= 8.5
          ? lang === 'zh'
            ? '✅ 健康范围'
            : '✅ Healthy range'
          : lang === 'zh'
            ? '⚠️ 需关注'
            : '⚠️ Needs attention',
      trendDirection:
        (overview.discount_rate ?? 0) >= 5 && (overview.discount_rate ?? 0) <= 8.5
          ? 'up'
          : 'down',
      subtitle: lang === 'zh' ? '行业基准 5-8%' : 'Industry benchmark 5-8%',
      tone:
        (overview.discount_rate ?? 0) >= 5 && (overview.discount_rate ?? 0) <= 8.5
          ? 'good'
          : 'warn',
    },
  ];
}

export function deriveDashboardInsightSnapshot(
  analysis: AnalysisResponse
): DashboardInsightSnapshot {
  const monthlyTrend = analysis.agentAParsed?.monthly_trend ?? [];
  const recommendationStats = getRecommendationStats(
    analysis.recommendations,
    analysis.executionPlansPreview
  );
  const priorityRecommendation = [...analysis.recommendations].sort((left, right) => {
    const scoreLeft = left.impact_score * 100 + (left.confidence ?? 0);
    const scoreRight = right.impact_score * 100 + (right.confidence ?? 0);
    return scoreRight - scoreLeft;
  })[0];

  return {
    ...deriveHealthSnapshot(analysis),
    monthlyTrend,
    platformDistribution: derivePlatformDistribution(analysis),
    warning: analysis.warning ?? analysis.summary.riskNotice,
    source: analysis.source,
    priorityRecommendation,
    recommendationStats,
  };
}

export function getDashboardAnalysis(lang: 'zh' | 'en') {
  const runtime = loadAnalysisRuntimeState();
  if (!runtime) {
    return {
      analysis: mockAnalysisResponse,
      metrics: dashboardMetrics,
      snapshot: deriveDashboardInsightSnapshot(mockAnalysisResponse),
      uploadedDocuments: [] as UploadedOpsDocument[],
      updatedAt: null as string | null,
    };
  }

  return {
    analysis: runtime.analysis,
    metrics: deriveDashboardMetrics(lang, runtime.analysis, runtime.updatedAt, runtime.uploadedDocuments),
    snapshot: deriveDashboardInsightSnapshot(runtime.analysis),
    uploadedDocuments: runtime.uploadedDocuments,
    updatedAt: runtime.updatedAt,
  };
}
