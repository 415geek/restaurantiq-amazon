import type { AnalysisResponse, UploadedOpsDocument } from '@/lib/types';
import { runOpenAIJsonSchema } from '@/lib/server/openai-json';
import { DAILY_BRIEFING_SYSTEM_PROMPT } from '@/lib/server/prompt-library';
import { generateNovaCompletion } from '@/lib/server/aws-nova-client';

type DailyBriefingResult = {
  briefing: string;
  highlights: string[];
};

type GenerateDailyBriefingInput = {
  analysis: AnalysisResponse;
  uploadedDocuments: UploadedOpsDocument[];
  lang?: 'zh' | 'en';
};

function isDailyBriefingResult(value: unknown): value is DailyBriefingResult {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.briefing !== 'string') return false;
  if (!Array.isArray(record.highlights)) return false;
  if (!record.highlights.every((item) => typeof item === 'string')) return false;
  return true;
}

async function tryNovaDailyBriefing(prompt: string): Promise<DailyBriefingResult | null> {
  try {
    const raw = await generateNovaCompletion(prompt, {
      model: process.env.AWS_NOVA_BRIEFING_MODEL || 'amazon.nova-pro-v1:0',
      temperature: 0.3,
      maxTokens: 1600,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as unknown;
    if (!isDailyBriefingResult(parsed)) return null;

    return {
      briefing: parsed.briefing.trim(),
      highlights: parsed.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 5),
    };
  } catch {
    return null;
  }
}

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

  const langLabel = input.lang === 'en' ? 'en' : 'zh';
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

  const langInstruction = input.lang === 'en'
    ? 'IMPORTANT: Respond entirely in English. Do not use any Chinese characters.'
    : '重要：请全部使用简体中文输出，不要夹杂英文。';

  const prompt = [
    DAILY_BRIEFING_SYSTEM_PROMPT.trim(),
    langInstruction,
    'Generate the daily briefing based on the following JSON:',
    JSON.stringify(compactPayload),
  ].join('\n\n');

  if (process.env.OPENAI_API_KEY) {
    const llmResult = await runOpenAIJsonSchema<DailyBriefingResult>({
      model:
        process.env.OPENAI_BRIEFING_MODEL ||
        process.env.OPENAI_ANALYSIS_MODEL ||
        'gpt-4o-mini',
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
            minLength: 20,
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
      prompt,
    });

    if (llmResult?.briefing) {
      return {
        source: 'live',
        result: {
          briefing: llmResult.briefing.trim(),
          highlights: llmResult.highlights?.length ? llmResult.highlights : fallback.highlights,
        },
      };
    }

    // If OpenAI is configured but fails, try Nova before falling back.
    const nova = await tryNovaDailyBriefing(prompt);
    if (nova) {
      return {
        source: 'live',
        result: nova,
        warning: 'Using AWS Nova for daily briefing (OpenAI unavailable).',
      };
    }

    return {
      source: 'fallback',
      result: fallback,
      warning: 'AI daily briefing is unavailable. Showing deterministic summary.',
    };
  }

  // No OpenAI key — try Nova.
  const nova = await tryNovaDailyBriefing(prompt);
  if (nova) {
    return {
      source: 'live',
      result: nova,
      warning: 'Using AWS Nova for daily briefing.',
    };
  }

  return {
    source: 'fallback',
    result: fallback,
    warning: 'AI daily briefing is unavailable. Showing deterministic summary.',
  };
}