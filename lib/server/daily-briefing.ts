import type { AnalysisResponse, UploadedOpsDocument } from '@/lib/types';
import { runOpenAIJsonSchema } from '@/lib/server/openai-json';
import { DAILY_BRIEFING_SYSTEM_PROMPT } from '@/lib/server/prompt-library';

type DailyBriefingResult = {
  briefing: string;
  highlights: string[];
};

type GenerateDailyBriefingInput = {
  analysis: AnalysisResponse;
  uploadedDocuments: UploadedOpsDocument[];
  lang?: 'zh' | 'en';
};

function toCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function toPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return `${value.toFixed(1)}%`;
}

function buildFallbackBriefing({
  analysis,
  uploadedDocuments,
  lang = 'zh',
}: GenerateDailyBriefingInput): DailyBriefingResult {
  const parsed = analysis.agentAParsed;
  const totalRevenue = parsed?.overview.total_revenue ?? null;
  const totalOrders = parsed?.overview.total_orders ?? null;
  const avgOrderValue = parsed?.overview.avg_order_value ?? null;
  const dailyOrders = parsed?.overview.daily_orders ?? null;
  const discountRate = parsed?.overview.discount_rate ?? null;
  const topRec = analysis.recommendations[0];

  if (lang === 'en') {
    const text = [
      `Good morning. Here is your RestaurantIQ daily briefing.`,
      '',
      `Data Snapshot`,
      `- Parsed files: ${uploadedDocuments.length}`,
      `- Total revenue: ${toCurrency(totalRevenue)}`,
      `- Total orders: ${totalOrders ?? '--'}`,
      `- Avg order value: ${toCurrency(avgOrderValue)}`,
      `- Daily orders: ${dailyOrders ?? '--'}`,
      `- Discount rate: ${toPercent(discountRate)}`,
      '',
      `Priority Focus`,
      `- ${analysis.summary.insight || 'No critical issue detected.'}`,
      topRec ? `- Recommended action: ${topRec.title}` : `- No recommendation generated yet.`,
    ].join('\n');
    return {
      briefing: text,
      highlights: [analysis.summary.insight, topRec?.title].filter(Boolean) as string[],
    };
  }

  const text = [
    `☀️ 早上好，这是你的 RestaurantIQ 每日简报。`,
    '',
    `📊 数据快照`,
    `• 已解析文件：${uploadedDocuments.length} 份`,
    `• 累计营收：${toCurrency(totalRevenue)}`,
    `• 累计订单：${totalOrders ?? '--'} 单`,
    `• 平均客单价：${toCurrency(avgOrderValue)}`,
    `• 日均订单：${dailyOrders ?? '--'} 单`,
    `• 折扣率：${toPercent(discountRate)}`,
    '',
    `⚠️ 当前重点`,
    `• ${analysis.summary.insight || '暂未发现高优先级异常。'}`,
    topRec ? `• 建议优先执行：${topRec.title_zh || topRec.title}` : `• 暂无新建议。`,
  ].join('\n');

  return {
    briefing: text,
    highlights: [analysis.summary.insight, topRec?.title_zh || topRec?.title].filter(
      Boolean
    ) as string[],
  };
}

export async function generateDailyBriefing(
  input: GenerateDailyBriefingInput
): Promise<{ source: 'live' | 'fallback'; result: DailyBriefingResult; warning?: string }> {
  const fallback = buildFallbackBriefing(input);
  if (!process.env.OPENAI_API_KEY) {
    return {
      source: 'fallback',
      result: fallback,
      warning: 'OPENAI_API_KEY is missing. Using deterministic daily briefing.',
    };
  }

  const langLabel = input.lang === 'en' ? 'English' : '简体中文';
  const compactPayload = {
    lang: langLabel,
    summary: input.analysis.summary,
    topRecommendations: input.analysis.recommendations.slice(0, 3).map((item) => ({
      title: item.title,
      title_zh: item.title_zh,
      impact_score: item.impact_score,
      urgency_level: item.urgency_level,
      expected_outcome: item.expected_outcome,
    })),
    agentAOverview: input.analysis.agentAParsed?.overview,
    uploadedDocuments: input.uploadedDocuments.slice(0, 8).map((item) => ({
      fileName: item.fileName,
      category: item.category,
      source: item.source,
      parsingStatus: item.parsingStatus,
    })),
    warning: input.analysis.warning,
  };

  const llmResult = await runOpenAIJsonSchema<DailyBriefingResult>({
    model: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-5-mini',
    temperature: 0.3,
    maxOutputTokens: 1600,
    schemaName: 'daily_briefing_output',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['briefing', 'highlights'],
      properties: {
        briefing: {
          type: 'string',
          minLength: 60,
          maxLength: 2200,
        },
        highlights: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: {
            type: 'string',
            minLength: 2,
            maxLength: 160,
          },
        },
      },
    },
    prompt: [
      DAILY_BRIEFING_SYSTEM_PROMPT.trim(),
      `输出语言：${langLabel}`,
      '请基于以下 JSON 生成每日简报：',
      JSON.stringify(compactPayload),
    ].join('\n\n'),
  });

  if (!llmResult?.briefing) {
    return {
      source: 'fallback',
      result: fallback,
      warning: 'OpenAI daily briefing generation failed. Using deterministic summary.',
    };
  }

  return {
    source: 'live',
    result: {
      briefing: llmResult.briefing.trim(),
      highlights: llmResult.highlights?.length ? llmResult.highlights : fallback.highlights,
    },
  };
}

