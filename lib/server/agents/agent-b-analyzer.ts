import type { AgentBAnalysisResult, AgentOutput } from '@/lib/types';
import type { AgentAParserResult } from '@/lib/types';
import { runOpenAIJsonSchema } from '@/lib/server/openai-json';

type Status = 'healthy' | 'warning' | 'critical';

function statusForDiscountRate(value: number | null): Status {
  if (value === null) return 'warning';
  if (value <= 0.2) return 'healthy';
  if (value <= 0.3) return 'warning';
  return 'critical';
}

function statusForAov(value: number | null): Status {
  if (value === null) return 'warning';
  if (value >= 35) return 'healthy';
  if (value >= 25) return 'warning';
  return 'critical';
}

function statusForOrdersPerDay(value: number | null): Status {
  if (value === null) return 'warning';
  if (value >= 30) return 'healthy';
  if (value >= 15) return 'warning';
  return 'critical';
}

function statusForRefundRate(value: number | null): Status {
  if (value === null) return 'healthy';
  if (value <= 0.02) return 'healthy';
  if (value <= 0.05) return 'warning';
  return 'critical';
}

function computeHealthScore(parsed: AgentAParserResult) {
  let score = 100;
  const discountRate = parsed.kpis.discounts.rate;
  const aov = parsed.kpis.aov.actual;
  const ordersPerDay = parsed.kpis.orders.per_day;

  if (discountRate !== null) {
    if (discountRate > 0.3) score -= 25;
    else if (discountRate > 0.2) score -= 15;
  }

  if (aov !== null) {
    if (aov < 25) score -= 20;
    else if (aov < 35) score -= 10;
  }

  if (ordersPerDay !== null) {
    if (ordersPerDay < 10) score -= 15;
    else if (ordersPerDay < 20) score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToGrade(score: number): Pick<
  AgentBAnalysisResult['analysis']['summary'],
  'health_grade' | 'health_grade_zh'
> {
  if (score >= 90) return { health_grade: 'A', health_grade_zh: '优' };
  if (score >= 80) return { health_grade: 'B', health_grade_zh: '良' };
  if (score >= 70) return { health_grade: 'C', health_grade_zh: '中' };
  if (score >= 60) return { health_grade: 'D', health_grade_zh: '差' };
  return { health_grade: 'F', health_grade_zh: '危' };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildDeterministicInsights(
  parsed: AgentAParserResult,
  dominantPlatform: string
): AgentBAnalysisResult['analysis']['insights'] {
  const revenue = parsed.kpis.revenue.actual_total ?? 0;
  const ordersPerDay = parsed.kpis.orders.per_day ?? 0;
  const discountRate = parsed.kpis.discounts.rate ?? 0;
  const aov = parsed.kpis.aov.actual ?? 0;
  const refundRate = parsed.kpis.refunds.rate ?? 0;

  return [
    {
      id: 'I-001',
      category: 'discount',
      priority: discountRate > 0.3 ? 'P0' : 'P1',
      icon: discountRate > 0.3 ? '🔴' : discountRate > 0.2 ? '🟡' : '🟢',
      finding: `Discount rate is ${formatPct(discountRate)} against a target of 20% or below.`,
      finding_zh: `当前折扣率为 ${formatPct(discountRate)}，高于理想目标 20% 以下。`,
      impact: discountRate > 0.2 ? 'Margin leakage is likely compressing contribution profit.' : 'Discount pressure is currently within a controllable range.',
      impact_zh: discountRate > 0.2 ? '折扣侵蚀利润，正在压缩单笔订单贡献。' : '当前折扣压力仍处于可控范围。',
      recommendation: discountRate > 0.2 ? 'Audit platform promotions first and remove low-efficiency discount rules.' : 'Keep current promo structure and monitor discount contribution by platform.',
      recommendation_zh: discountRate > 0.2 ? '优先审核各平台促销，先下线低效率折扣规则。' : '保持当前促销结构，并持续监控各平台折扣贡献。',
    },
    {
      id: 'I-002',
      category: 'aov',
      priority: aov < 25 ? 'P0' : 'P1',
      icon: aov < 25 ? '🔴' : aov < 35 ? '🟡' : '🟢',
      finding: `Average order value is ${formatCurrency(aov)} versus the $35 benchmark.`,
      finding_zh: `当前客单价为 ${formatCurrency(aov)}，对比基准 $35。`,
      impact: aov < 35 ? 'Low basket size limits revenue growth even when order volume stabilizes.' : 'Basket size is healthy and can support margin expansion.',
      impact_zh: aov < 35 ? '客单价偏低，即使订单量稳定也会限制营收增长。' : '客单价表现健康，有利于进一步扩大利润。',
      recommendation: aov < 35 ? 'Create bundles and add-on upsell paths on the highest-volume channels.' : 'Push high-value combinations on top-performing channels to protect AOV.',
      recommendation_zh: aov < 35 ? '在高单量渠道上线套餐与加购路径，拉升客单价。' : '在高表现渠道主推高价值组合，守住客单价。',
    },
    {
      id: 'I-003',
      category: 'platform',
      priority: 'P1',
      icon: dominantPlatform ? '🟢' : '🟡',
      finding: dominantPlatform
        ? `${dominantPlatform} is currently the dominant channel.`
        : 'Platform mix is not yet clear from the uploaded data.',
      finding_zh: dominantPlatform ? `${dominantPlatform} 是当前主导渠道。` : '上传数据中尚未形成明确的平台结构。',
      impact: dominantPlatform ? 'Channel concentration can amplify both wins and operational risk.' : 'Without a clear platform mix, pricing and promo decisions stay blunt.',
      impact_zh: dominantPlatform ? '渠道集中既会放大收益，也会放大运营风险。' : '没有清晰平台结构时，定价和促销决策会偏粗放。',
      recommendation: dominantPlatform
        ? `Optimize ${dominantPlatform} first, then compare AOV and discount intensity against secondary channels.`
        : 'Request platform-level order and revenue splits before launching pricing experiments.',
      recommendation_zh: dominantPlatform
        ? `优先优化 ${dominantPlatform}，再对比次要渠道的客单价与折扣强度。`
        : '在启动定价实验前，先补齐平台级订单和营收拆分。',
    },
    {
      id: 'I-004',
      category: 'growth',
      priority: ordersPerDay < 15 ? 'P0' : 'P1',
      icon: ordersPerDay < 15 ? '🔴' : ordersPerDay < 30 ? '🟡' : '🟢',
      finding: `Orders per day are ${ordersPerDay.toFixed(1)} versus the 30/day benchmark.`,
      finding_zh: `当前日均订单量为 ${ordersPerDay.toFixed(1)}，对比基准 30 单/日。`,
      impact: ordersPerDay < 30 ? 'Traffic efficiency is below benchmark and likely suppressing revenue velocity.' : 'Traffic is healthy enough to support optimization experiments.',
      impact_zh: ordersPerDay < 30 ? '客流效率低于基准，正在压低营收速度。' : '客流量足以支撑进一步优化实验。',
      recommendation: ordersPerDay < 30 ? 'Use platform-specific promos and local demand hooks to recover order volume.' : 'Shift focus from traffic acquisition to basket and margin optimization.',
      recommendation_zh: ordersPerDay < 30 ? '结合平台定向促销和本地需求场景，优先恢复订单量。' : '将重点从拉新转向客单价和利润优化。',
    },
    {
      id: 'I-005',
      category: 'growth',
      priority: refundRate > 0.02 ? 'P1' : 'P2',
      icon: refundRate > 0.05 ? '🔴' : refundRate > 0.02 ? '🟡' : '🟢',
      finding: `Refund rate is ${formatPct(refundRate)} based on uploaded operations data.`,
      finding_zh: `基于上传运营数据，当前退款率为 ${formatPct(refundRate)}。`,
      impact: refundRate > 0.02 ? 'Refunds are likely masking quality or fulfillment issues.' : 'Refund performance is stable enough to focus on growth initiatives.',
      impact_zh: refundRate > 0.02 ? '退款正在暴露品质或履约问题。' : '退款表现稳定，可以把重点放在增长动作上。',
      recommendation: refundRate > 0.02 ? 'Audit refund reasons and connect them to specific channels or menu items.' : 'Continue tracking refund reasons, but prioritize discount and AOV levers first.',
      recommendation_zh: refundRate > 0.02 ? '梳理退款原因，并关联到具体渠道或菜品。' : '继续跟踪退款原因，但优先处理折扣率和客单价。',
    },
  ];
}

async function maybeEnrichAnalysis(
  draft: AgentBAnalysisResult,
  parsed: AgentAParserResult
): Promise<Pick<AgentBAnalysisResult['analysis']['summary'], 'top_issue' | 'top_issue_zh' | 'top_opportunity' | 'top_opportunity_zh'> | null> {
  return runOpenAIJsonSchema<Pick<AgentBAnalysisResult['analysis']['summary'], 'top_issue' | 'top_issue_zh' | 'top_opportunity' | 'top_opportunity_zh'>>({
    model: process.env.OPENAI_ANALYZER_MODEL || 'gpt-4o',
    temperature: 0.1,
    maxOutputTokens: 600,
    prompt: [
      'You are Agent B, the Analytics Engine for RestaurantIQ.',
      'Given parsed KPI data, identify the top issue and top opportunity in bilingual form.',
      'Do not invent metrics. Keep text concise and specific.',
      JSON.stringify({
        parsed,
        deterministic_analysis: draft.analysis,
      }),
    ].join('\n'),
    schemaName: 'agent_b_summary_enrichment',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['top_issue', 'top_issue_zh', 'top_opportunity', 'top_opportunity_zh'],
      properties: {
        top_issue: { type: 'string' },
        top_issue_zh: { type: 'string' },
        top_opportunity: { type: 'string' },
        top_opportunity_zh: { type: 'string' },
      },
    },
  });
}

export async function runAgentBAnalyzer(parsed: AgentAParserResult): Promise<{
  analyzed: AgentBAnalysisResult;
  output: AgentOutput;
}> {
  const healthScore = computeHealthScore(parsed);
  const { health_grade, health_grade_zh } = scoreToGrade(healthScore);
  const revenue = parsed.kpis.revenue.actual_total ?? 0;
  const days = parsed.kpis.orders.days_with_data ?? 0;
  const dailyAvg = days > 0 ? revenue / days : 0;
  const orders = parsed.kpis.orders.total ?? 0;
  const ordersPerDay = parsed.kpis.orders.per_day ?? 0;
  const aov = parsed.kpis.aov.actual ?? 0;
  const discountRate = parsed.kpis.discounts.rate ?? 0;
  const refundRate = parsed.kpis.refunds.rate ?? 0;
  const platforms = Object.entries(parsed.platform_breakdown).map(([name, value]) => ({
    name,
    orders: value.orders,
    revenue: value.revenue,
    share_pct: value.share_pct,
    aov: value.orders > 0 ? Number((value.revenue / value.orders).toFixed(2)) : 0,
    insight:
      value.share_pct >= 40
        ? `${name} is the primary demand source and should be optimized first.`
        : `${name} is a secondary channel that can be used for targeted experiments.`,
    insight_zh:
      value.share_pct >= 40
        ? `${name} 是主要订单来源，应该优先优化。`
        : `${name} 是次要渠道，适合做定向实验。`,
  }));
  const dominantPlatform = [...platforms].sort((left, right) => right.orders - left.orders)[0]?.name ?? '';
  const completenessInputs = [
    parsed.kpis.revenue.actual_total,
    parsed.kpis.orders.total,
    parsed.kpis.orders.per_day,
    parsed.kpis.aov.actual,
    parsed.kpis.discounts.rate,
  ];
  const completeness = Math.round(
    (completenessInputs.filter((value) => value !== null && value !== undefined).length / completenessInputs.length) * 100
  );

  const draft: AgentBAnalysisResult = {
    analysis: {
      summary: {
        restaurant_name: parsed.meta.restaurant_name,
        period:
          parsed.meta.data_sources.length > 0
            ? `${parsed.meta.data_sources[0]?.date_range.start ?? ''} ~ ${parsed.meta.data_sources.at(-1)?.date_range.end ?? ''}`.trim()
            : '',
        health_score: healthScore,
        health_grade,
        health_grade_zh,
        top_issue:
          discountRate > 0.2
            ? `Discount rate at ${formatPct(discountRate)} is too high.`
            : ordersPerDay < 30
              ? `Orders per day at ${ordersPerDay.toFixed(1)} are below benchmark.`
              : `No critical KPI breakdown detected.`,
        top_issue_zh:
          discountRate > 0.2
            ? `折扣率 ${formatPct(discountRate)} 偏高。`
            : ordersPerDay < 30
              ? `日均订单量 ${ordersPerDay.toFixed(1)} 低于基准。`
              : '当前没有出现严重 KPI 失衡。',
        top_opportunity:
          aov < 35
            ? `AOV at ${formatCurrency(aov)} can be lifted with bundles and add-ons.`
            : dominantPlatform
              ? `${dominantPlatform} can be optimized to protect margin and volume.`
              : 'Platform mix optimization remains the clearest opportunity.',
        top_opportunity_zh:
          aov < 35
            ? `当前客单价 ${formatCurrency(aov)}，可通过套餐和加购提升。`
            : dominantPlatform
              ? `可以优先优化 ${dominantPlatform}，兼顾利润和单量。`
              : '平台结构优化仍然是最清晰的提升机会。',
        data_quality: parsed.confidence.overall,
      },
      kpis: {
        revenue: {
          value: Number(revenue.toFixed(2)),
          formatted: formatCurrency(revenue),
          daily_avg: Number(dailyAvg.toFixed(2)),
          status: revenue > 0 ? 'healthy' : 'critical',
        },
        orders: {
          value: orders,
          per_day: Number(ordersPerDay.toFixed(2)),
          benchmark: 30,
          status: statusForOrdersPerDay(parsed.kpis.orders.per_day),
          gap: Number((ordersPerDay - 30).toFixed(2)),
        },
        aov: {
          value: Number(aov.toFixed(2)),
          formatted: formatCurrency(aov),
          benchmark: 35,
          status: statusForAov(parsed.kpis.aov.actual),
          gap: Number((aov - 35).toFixed(2)),
        },
        discount_rate: {
          value: Number(discountRate.toFixed(4)),
          formatted: formatPct(discountRate),
          benchmark: 0.2,
          status: statusForDiscountRate(parsed.kpis.discounts.rate),
          monthly_cost: Number((discountRate * revenue).toFixed(2)),
        },
        refund_rate: {
          value: Number(refundRate.toFixed(4)),
          formatted: formatPct(refundRate),
          status: statusForRefundRate(parsed.kpis.refunds.rate),
        },
      },
      platform_analysis: {
        total_platforms: platforms.length,
        dominant_platform: dominantPlatform,
        platforms,
      },
      insights: buildDeterministicInsights(parsed, dominantPlatform),
    },
    qa: {
      data_completeness: completeness,
      publish: completeness >= 60,
    },
  };

  const enriched = await maybeEnrichAnalysis(draft, parsed);
  const analyzed = enriched
    ? {
        ...draft,
        analysis: {
          ...draft.analysis,
          summary: {
            ...draft.analysis.summary,
            ...enriched,
          },
        },
      }
    : draft;

  return {
    analyzed,
    output: {
      agent: 'B',
      title: 'Analytics Engine',
      summary: `Agent B scored the business at ${healthScore}/100 (${health_grade}) and generated ${analyzed.analysis.insights.length} KPI-driven insights.`,
      structuredPayload: analyzed,
      evidenceRefs: [],
      confidence: Math.max(0.55, completeness / 100),
      warnings:
        completeness < 60
          ? ['Data completeness is low. Agent B analysis is partially constrained by missing KPI fields.']
          : undefined,
    },
  };
}
