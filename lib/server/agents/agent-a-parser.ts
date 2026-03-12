import type { AgentAConfidence, AgentAParserResult, AgentOutput, EvidenceRef, UploadedOpsDocument } from '@/lib/types';
import type { AnalysisInput } from '@/lib/server/orchestration/types';
import { buildOpsNormalizationDigest } from '@/lib/server/ops-document-parser';
import { runOpenAIJsonSchema } from '@/lib/server/openai-json';

function deriveConfidence(parsedRatio: number, issues: string[]): AgentAConfidence {
  if (parsedRatio >= 0.85 && issues.length <= 1) return 'high';
  if (parsedRatio >= 0.5) return 'medium';
  return 'low';
}

function round(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number(value.toFixed(2));
}

function formatMonthLabel(dateString: string | null | undefined) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    monthKey: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    label: `${date.getUTCMonth() + 1}月`,
    labelEn: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
  };
}

function extractRestaurantName(input: AnalysisInput, uploadedDocuments: UploadedOpsDocument[]) {
  const configName = typeof input.restaurantConfig?.name === 'string' ? input.restaurantConfig.name.trim() : '';
  if (configName) return configName;
  const firstFile = uploadedDocuments[0]?.fileName ?? '';
  return firstFile.split(/[_\-\s]/u).filter(Boolean)[0] ?? '';
}

async function maybeEnrichParserNotes(
  draft: AgentAParserResult,
  uploadedDocuments: UploadedOpsDocument[]
): Promise<Pick<AgentAParserResult, 'parsing_notes' | 'confidence'> | null> {
  const compactDocs = uploadedDocuments.slice(0, 8).map((document) => ({
    fileName: document.fileName,
    category: document.category,
    excerpt: document.excerpt,
    cleaningActions: document.cleaningActions?.slice(0, 4) ?? [],
    structuredPreview: {
      sourceType: document.structuredPreview?.sourceType,
      canonicalMetrics: document.structuredPreview?.canonicalMetrics ?? {},
      datasetHints: document.structuredPreview?.datasetHints ?? [],
      qualityFlags: document.structuredPreview?.qualityFlags ?? [],
      parserConfidence: document.structuredPreview?.parserConfidence,
    },
  }));

  return runOpenAIJsonSchema<Pick<AgentAParserResult, 'parsing_notes' | 'confidence'>>({
    model: process.env.OPENAI_PARSER_MODEL || 'gpt-4o-mini',
    temperature: 0,
    maxOutputTokens: 1200,
    prompt: [
      'You are Agent A, the Data Parser for RestaurantIQ.',
      'Review the deterministic parse result and return concise parsing notes plus confidence only.',
      'Do not change any KPI values. Focus on parser quality and caveats.',
      JSON.stringify({
        parser_result: draft,
        uploaded_documents: compactDocs,
      }),
    ].join('\n'),
    schemaName: 'agent_a_parser_enrichment',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['parsing_notes', 'confidence'],
      properties: {
        parsing_notes: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 8,
        },
        confidence: {
          type: 'object',
          additionalProperties: false,
          required: ['overall', 'flags'],
          properties: {
            overall: { type: 'string', enum: ['high', 'medium', 'low'] },
            flags: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 8,
            },
          },
        },
      },
    },
  });
}

export async function runAgentAParser(input: AnalysisInput): Promise<{
  parsed: AgentAParserResult;
  output: AgentOutput;
}> {
  const uploadedDocuments = input.uploadedDocuments ?? [];
  const normalization = buildOpsNormalizationDigest(uploadedDocuments);
  const dataSources = normalization.normalizedDatasets.map((dataset) => ({
    filename: dataset.fileName,
    type:
      dataset.sourceType === 'order_details'
        ? '账单明细'
        : dataset.sourceType === 'item_summary'
          ? '菜品汇总'
          : '其他',
    date_range: {
      start: dataset.dateRange?.start ?? null,
      end: dataset.dateRange?.end ?? null,
    },
    rows: dataset.rowCount,
  })) satisfies AgentAParserResult['meta']['data_sources'];

  const mergedBusinessMetrics = normalization.normalizedDatasets.reduce<{
    totalOrders: number;
    daysWithData: number;
    actualRevenue: number;
    grossRevenue: number;
    discountTotal: number;
    tipsTotal: number;
    refundCount: number;
    refundAmount: number;
    itemsSold: number;
  }>(
    (accumulator, dataset) => {
      const metrics = dataset.businessMetrics;
      accumulator.totalOrders += metrics.totalOrders ?? 0;
      accumulator.daysWithData += metrics.daysWithData ?? 0;
      accumulator.actualRevenue += metrics.actualRevenue ?? 0;
      accumulator.grossRevenue += metrics.grossRevenue ?? 0;
      accumulator.discountTotal += metrics.discountTotal ?? 0;
      accumulator.tipsTotal += metrics.tipsTotal ?? 0;
      accumulator.refundCount += metrics.refundCount ?? 0;
      accumulator.refundAmount += metrics.refundAmount ?? 0;
      accumulator.itemsSold += metrics.itemsSold ?? 0;
      return accumulator;
    },
    {
      totalOrders: 0,
      daysWithData: 0,
      actualRevenue: 0,
      grossRevenue: 0,
      discountTotal: 0,
      tipsTotal: 0,
      refundCount: 0,
      refundAmount: 0,
      itemsSold: 0,
    }
  );

  const parsedCount = normalization.normalizedDatasets.filter((dataset) => dataset.parsingStatus === 'parsed').length;
  const grossRevenue = mergedBusinessMetrics.grossRevenue || mergedBusinessMetrics.actualRevenue || 0;
  const actualRevenue = mergedBusinessMetrics.actualRevenue || 0;
  const totalOrders = mergedBusinessMetrics.totalOrders || 0;
  const daysWithData = mergedBusinessMetrics.daysWithData || 0;
  const refundCount = mergedBusinessMetrics.refundCount || 0;
  const refundAmount = mergedBusinessMetrics.refundAmount || 0;
  const confidenceFlags = Array.from(
    new Set([
      ...normalization.qualitySummary.issues,
      ...normalization.normalizedDatasets.flatMap((dataset) => dataset.qualityFlags),
    ])
  ).slice(0, 8);
  const overview = {
    total_orders: totalOrders > 0 ? totalOrders : null,
    total_revenue: actualRevenue > 0 ? round(actualRevenue) : null,
    avg_order_value: totalOrders > 0 && actualRevenue > 0 ? round(actualRevenue / totalOrders) : null,
    daily_orders: totalOrders > 0 && daysWithData > 0 ? round(totalOrders / daysWithData) : null,
    discount_rate:
      mergedBusinessMetrics.discountTotal > 0 && grossRevenue > 0
        ? round((mergedBusinessMetrics.discountTotal / grossRevenue) * 100)
        : null,
    total_discount: mergedBusinessMetrics.discountTotal > 0 ? round(mergedBusinessMetrics.discountTotal) : null,
    total_refunds: refundAmount > 0 ? round(refundAmount) : null,
    gross_revenue: grossRevenue > 0 ? round(grossRevenue) : null,
  } satisfies AgentAParserResult['overview'];

  const monthlyTrend = normalization.normalizedDatasets
    .map((dataset) => {
      const monthInfo = formatMonthLabel(dataset.dateRange?.start ?? null);
      if (!monthInfo) return null;
      const metrics = dataset.businessMetrics;
      const totalOrdersForMonth = metrics.totalOrders ?? 0;
      const totalRevenueForMonth = metrics.actualRevenue ?? metrics.grossRevenue ?? 0;
      const grossRevenueForMonth = metrics.grossRevenue ?? totalRevenueForMonth;
      const totalDiscountForMonth = metrics.discountTotal ?? 0;
      const totalRefundForMonth = metrics.refundAmount ?? 0;
      const daysForMonth = metrics.daysWithData ?? 0;
      const avgOrderValue =
        dataset.canonicalMetrics.avg_order_value
        ?? (totalOrdersForMonth > 0 && totalRevenueForMonth > 0 ? Number((totalRevenueForMonth / totalOrdersForMonth).toFixed(2)) : 0);
      const dailyOrders =
        dataset.canonicalMetrics.daily_orders
        ?? (totalOrdersForMonth > 0 && daysForMonth > 0 ? Number((totalOrdersForMonth / daysForMonth).toFixed(2)) : 0);
      const discountRate =
        dataset.canonicalMetrics.discount_rate
        ?? (totalDiscountForMonth > 0 && grossRevenueForMonth > 0
          ? Number(((totalDiscountForMonth / grossRevenueForMonth) * 100).toFixed(2))
          : 0);

      return {
        monthKey: monthInfo.monthKey,
        monthLabel: monthInfo.label,
        monthLabelEn: monthInfo.labelEn,
        orders: totalOrdersForMonth,
        revenue: Number(totalRevenueForMonth.toFixed(2)),
        avgOrderValue: Number(avgOrderValue.toFixed(2)),
        dailyOrders: Number(dailyOrders.toFixed(1)),
        discountRate: Number(discountRate.toFixed(2)),
        discountTotal: Number(totalDiscountForMonth.toFixed(2)),
        refundTotal: Number(totalRefundForMonth.toFixed(2)),
        grossRevenue: Number(grossRevenueForMonth.toFixed(2)),
        daysWithData: daysForMonth,
      };
    })
    .filter((dataset): dataset is NonNullable<typeof dataset> => Boolean(dataset))
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey));

  const draft: AgentAParserResult = {
    meta: {
      parser_version: '3.0',
      restaurant_name: extractRestaurantName(input, uploadedDocuments),
      currency: 'USD',
      data_sources: dataSources,
      parsed_at: new Date().toISOString(),
    },
    overview,
    kpis: {
      revenue: {
        actual_total: actualRevenue > 0 ? round(actualRevenue) : null,
        gross_total: grossRevenue > 0 ? round(grossRevenue) : null,
      },
      orders: {
        total: totalOrders > 0 ? totalOrders : null,
        days_with_data: daysWithData > 0 ? daysWithData : null,
        per_day: totalOrders > 0 && daysWithData > 0 ? round(totalOrders / daysWithData) : null,
      },
      aov: {
        actual: totalOrders > 0 && actualRevenue > 0 ? round(actualRevenue / totalOrders) : null,
      },
      discounts: {
        total: mergedBusinessMetrics.discountTotal > 0 ? round(mergedBusinessMetrics.discountTotal) : null,
        rate: mergedBusinessMetrics.discountTotal > 0 && grossRevenue > 0 ? round(mergedBusinessMetrics.discountTotal / grossRevenue) : null,
      },
      refunds: {
        total: refundAmount > 0 ? round(refundAmount) : null,
        count: refundCount > 0 ? round(refundCount) : null,
        rate: refundCount > 0 && totalOrders > 0 ? round(refundCount / totalOrders) : null,
      },
      tips: {
        total: mergedBusinessMetrics.tipsTotal > 0 ? round(mergedBusinessMetrics.tipsTotal) : null,
      },
      items_sold: {
        total: mergedBusinessMetrics.itemsSold > 0 ? round(mergedBusinessMetrics.itemsSold) : null,
      },
    },
    platform_breakdown: Object.fromEntries(
      Object.entries(
        normalization.normalizedDatasets.reduce<Record<string, { orders: number; revenue: number; share_pct: number }>>(
          (accumulator, dataset) => {
            for (const [key, value] of Object.entries(dataset.platformBreakdown)) {
              const current = accumulator[key] ?? { orders: 0, revenue: 0, share_pct: 0 };
              current.orders += value.orders;
              current.revenue = Number((current.revenue + value.revenue).toFixed(2));
              accumulator[key] = current;
            }
            return accumulator;
          },
          {}
        )
      ).map(([key, value], _index, all) => {
        const total = all.reduce((sum, [, item]) => sum + item.orders, 0);
        return [
          key,
          {
            orders: value.orders,
            revenue: round(value.revenue) ?? 0,
            share_pct: total > 0 ? round((value.orders / total) * 100) ?? 0 : 0,
          },
        ];
      })
    ),
    order_type_breakdown: Object.fromEntries(
      Object.entries(
        normalization.normalizedDatasets.reduce<Record<string, { orders: number; revenue: number; share_pct: number }>>(
          (accumulator, dataset) => {
            for (const [key, value] of Object.entries(dataset.orderTypeBreakdown)) {
              const current = accumulator[key] ?? { orders: 0, revenue: 0, share_pct: 0 };
              current.orders += value.orders;
              current.revenue = Number((current.revenue + value.revenue).toFixed(2));
              accumulator[key] = current;
            }
            return accumulator;
          },
          {}
        )
      ).map(([key, value], _index, all) => {
        const total = all.reduce((sum, [, item]) => sum + item.orders, 0);
        return [
          key,
          {
            orders: value.orders,
            revenue: round(value.revenue) ?? 0,
            share_pct: total > 0 ? round((value.orders / total) * 100) ?? 0 : 0,
          },
        ];
      })
    ),
    monthly_trend: monthlyTrend,
    parsing_notes: [
      `${parsedCount}/${uploadedDocuments.length} 份文件已完成结构化解析。`,
      overview.total_revenue !== null && overview.total_orders !== null
        ? `累计营收 ${overview.total_revenue} 美元，累计订单 ${overview.total_orders} 单，平均客单价 ${overview.avg_order_value ?? '--'} 美元。`
        : '尚未形成可用经营总览指标。',
      ...normalization.normalizedDatasets.slice(0, 4).map(
        (dataset) =>
          `${dataset.fileName}: ${dataset.sourceType} · ${dataset.rowCount} rows · ${(dataset.parserConfidence * 100).toFixed(0)}%`
      ),
      ...confidenceFlags.map((flag) => `Flag: ${flag}`),
    ].slice(0, 8),
    confidence: {
      overall: deriveConfidence(normalization.qualitySummary.parsedRatio, confidenceFlags),
      flags: confidenceFlags,
    },
  };

  const enriched = await maybeEnrichParserNotes(draft, uploadedDocuments);
  const parsed = enriched
    ? {
        ...draft,
        parsing_notes: enriched.parsing_notes,
        confidence: enriched.confidence,
      }
    : draft;

  const evidenceRefs: EvidenceRef[] = uploadedDocuments.slice(0, 8).map((document) => ({
    id: `upload-${document.id}`,
    sourceType: 'upload',
    sourceId: document.id,
    title: document.fileName,
    excerpt: document.excerpt,
    freshness: document.uploadedAt,
    confidence: document.parsingStatus === 'parsed' ? document.structuredPreview?.parserConfidence ?? 0.8 : 0.3,
  }));

  const outputWarnings = [
    ...parsed.confidence.flags,
    ...(parsedCount < uploadedDocuments.length ? ['Some uploaded files still require richer parser adapters.'] : []),
  ].filter(Boolean);

  return {
    parsed,
    output: {
      agent: 'A',
      title: 'Data Parser',
      summary:
        uploadedDocuments.length > 0
          ? `Agent A parsed ${parsedCount} of ${uploadedDocuments.length} uploaded document(s) into standardized restaurant KPIs.`
          : 'Agent A is waiting for uploaded operating data.',
      structuredPayload: parsed,
      evidenceRefs,
      confidence:
        parsed.confidence.overall === 'high'
          ? 0.9
          : parsed.confidence.overall === 'medium'
            ? 0.72
            : 0.48,
      warnings: outputWarnings.length ? outputWarnings : undefined,
    },
  };
}
