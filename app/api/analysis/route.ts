import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { appEnv } from '@/lib/env';
import { orchestrateRestaurantAnalysis } from '@/lib/server/orchestration/analysis-orchestrator';
import { runBusinessIntelAnalysis } from '@/lib/server/business-intel-analysis';
import { savePersistedAnalysisRuntimeState } from '@/lib/server/analysis-runtime-store';
import { buildUberEatsOpsDocument } from '@/lib/server/adapters/ubereats-ops';
import type { UploadedOpsDocument } from '@/lib/types';

const schema = z.object({
  restaurantConfig: z.record(z.string(), z.unknown()).optional(),
  sortBy: z.enum(['composite', 'impact', 'urgency']).optional(),
  compareMode: z.boolean().optional(),
  uploadedDocuments: z.array(z.record(z.string(), z.unknown())).optional(),
  businessTarget: z
    .object({
      name: z.string().min(1),
      address: z.string().min(2),
      googlePlaceId: z.string().optional(),
      yelpBusinessId: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
});

const VALID_CATEGORIES = new Set<UploadedOpsDocument['category']>([
  'pos',
  'delivery',
  'staffing',
  'inventory',
  'mixed',
  'unknown',
]);
const VALID_DOCUMENT_SOURCES = new Set<UploadedOpsDocument['source']>([
  'manual_upload',
  'ubereats_api',
]);
const VALID_PARSING_STATUSES = new Set<UploadedOpsDocument['parsingStatus']>(['parsed', 'metadata_only']);
type StructuredPreview = NonNullable<UploadedOpsDocument['structuredPreview']>;

const VALID_FORMATS = new Set<StructuredPreview['format']>([
  'csv',
  'tsv',
  'json',
  'text',
  'xlsx',
  'binary',
]);
const VALID_SOURCE_TYPES = new Set<StructuredPreview['sourceType']>([
  'order_details',
  'item_summary',
  'generic',
]);
const VALID_TIME_GRAINS = new Set<StructuredPreview['inferredTimeGrain']>([
  'intraday',
  'daily',
  'weekly',
  'monthly',
  'unknown',
]);

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  return normalized.length ? normalized : undefined;
}

function asNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter(([, item]) => typeof item === 'number' && Number.isFinite(item));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter(([, item]) => typeof item === 'string');
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function asBreakdownRecord(value: unknown): Record<string, { orders: number; revenue: number }> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .map(([key, item]) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const orders = asNumber((item as { orders?: unknown }).orders, Number.NaN);
      const revenue = asNumber((item as { revenue?: unknown }).revenue, Number.NaN);
      if (!Number.isFinite(orders) || !Number.isFinite(revenue)) return null;
      return [key, { orders, revenue }] as const;
    })
    .filter((entry): entry is readonly [string, { orders: number; revenue: number }] => entry !== null);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeStructuredPreview(value: unknown): UploadedOpsDocument['structuredPreview'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const format = VALID_FORMATS.has(raw.format as StructuredPreview['format'])
    ? (raw.format as StructuredPreview['format'])
    : 'binary';
  const sourceType = VALID_SOURCE_TYPES.has(raw.sourceType as StructuredPreview['sourceType'])
    ? (raw.sourceType as StructuredPreview['sourceType'])
    : undefined;
  const inferredTimeGrain = VALID_TIME_GRAINS.has(raw.inferredTimeGrain as StructuredPreview['inferredTimeGrain'])
    ? (raw.inferredTimeGrain as StructuredPreview['inferredTimeGrain'])
    : undefined;

  const rowSample = Array.isArray(raw.rowSample)
    ? raw.rowSample
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((item) =>
          Object.fromEntries(
            Object.entries(item)
              .filter(([, entryValue]) => ['string', 'number', 'boolean'].includes(typeof entryValue))
              .map(([key, entryValue]) => [key, String(entryValue)])
          )
        )
        .filter((item) => Object.keys(item).length > 0)
    : undefined;

  const businessMetricsRaw =
    raw.businessMetrics && typeof raw.businessMetrics === 'object' && !Array.isArray(raw.businessMetrics)
      ? (raw.businessMetrics as Record<string, unknown>)
      : null;

  return {
    format,
    sourceType,
    rowCount: typeof raw.rowCount === 'number' ? raw.rowCount : undefined,
    columns: asStringArray(raw.columns),
    sampleValues: asStringRecord(raw.sampleValues),
    numericMetrics: asNumberRecord(raw.numericMetrics),
    canonicalMetrics: asNumberRecord(raw.canonicalMetrics),
    businessMetrics: businessMetricsRaw
      ? {
          totalOrders: typeof businessMetricsRaw.totalOrders === 'number' ? businessMetricsRaw.totalOrders : undefined,
          daysWithData: typeof businessMetricsRaw.daysWithData === 'number' ? businessMetricsRaw.daysWithData : undefined,
          actualRevenue: typeof businessMetricsRaw.actualRevenue === 'number' ? businessMetricsRaw.actualRevenue : undefined,
          grossRevenue: typeof businessMetricsRaw.grossRevenue === 'number' ? businessMetricsRaw.grossRevenue : undefined,
          discountTotal: typeof businessMetricsRaw.discountTotal === 'number' ? businessMetricsRaw.discountTotal : undefined,
          tipsTotal: typeof businessMetricsRaw.tipsTotal === 'number' ? businessMetricsRaw.tipsTotal : undefined,
          refundCount: typeof businessMetricsRaw.refundCount === 'number' ? businessMetricsRaw.refundCount : undefined,
          refundAmount: typeof businessMetricsRaw.refundAmount === 'number' ? businessMetricsRaw.refundAmount : undefined,
          itemsSold: typeof businessMetricsRaw.itemsSold === 'number' ? businessMetricsRaw.itemsSold : undefined,
        }
      : undefined,
    platformBreakdown: asBreakdownRecord(raw.platformBreakdown),
    orderTypeBreakdown: asBreakdownRecord(raw.orderTypeBreakdown),
    dateStats:
      raw.dateStats && typeof raw.dateStats === 'object' && !Array.isArray(raw.dateStats)
        ? {
            uniqueDays: typeof (raw.dateStats as { uniqueDays?: unknown }).uniqueDays === 'number'
              ? ((raw.dateStats as { uniqueDays?: number }).uniqueDays)
              : undefined,
          }
        : undefined,
    dateRange:
      raw.dateRange && typeof raw.dateRange === 'object' && !Array.isArray(raw.dateRange)
        ? {
            start: asString((raw.dateRange as { start?: unknown }).start) || undefined,
            end: asString((raw.dateRange as { end?: unknown }).end) || undefined,
          }
        : undefined,
    detectedKeywords: asStringArray(raw.detectedKeywords),
    datasetHints: asStringArray(raw.datasetHints),
    rowSample,
    qualityFlags: asStringArray(raw.qualityFlags),
    parserConfidence: typeof raw.parserConfidence === 'number' ? raw.parserConfidence : undefined,
    inferredTimeGrain,
  };
}

function normalizeUploadedDocument(value: Record<string, unknown>, index: number): UploadedOpsDocument {
  const category = VALID_CATEGORIES.has(value.category as UploadedOpsDocument['category'])
    ? (value.category as UploadedOpsDocument['category'])
    : 'unknown';
  const parsingStatus = VALID_PARSING_STATUSES.has(value.parsingStatus as UploadedOpsDocument['parsingStatus'])
    ? (value.parsingStatus as UploadedOpsDocument['parsingStatus'])
    : 'metadata_only';
  const source = VALID_DOCUMENT_SOURCES.has(value.source as UploadedOpsDocument['source'])
    ? (value.source as UploadedOpsDocument['source'])
    : 'manual_upload';

  return {
    id: asString(value.id, crypto.randomUUID()),
    fileName: asString(value.fileName, `uploaded-document-${index + 1}`),
    mimeType: asString(value.mimeType, 'application/octet-stream'),
    size: asNumber(value.size, 0),
    category,
    parsingStatus,
    source,
    extractedText: asString(value.extractedText),
    excerpt: asString(value.excerpt, asString(value.fileName, `uploaded-document-${index + 1}`)),
    cleaningActions: asStringArray(value.cleaningActions),
    structuredPreview: normalizeStructuredPreview(value.structuredPreview),
    uploadedAt: asString(value.uploadedAt, new Date().toISOString()),
  };
}

function normalizeBusinessTarget(target: z.infer<typeof schema>['businessTarget']) {
  if (!target) return null;
  return {
    name: target.name.trim(),
    address: target.address.trim(),
    googlePlaceId: target.googlePlaceId?.trim() || undefined,
    yelpBusinessId: target.yelpBusinessId?.trim() || undefined,
    lat: target.lat,
    lng: target.lng,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid analysis request payload.' }, { status: 400 });
  }

  const uploadedDocuments = (parsed.data.uploadedDocuments ?? []).map(normalizeUploadedDocument);
  const businessTarget = normalizeBusinessTarget(parsed.data.businessTarget);
  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';

  let ubereatsWarning: string | undefined;
  const analysisDocuments = uploadedDocuments.filter((doc) => doc.source !== 'ubereats_api');
  if (!businessTarget) {
    const ubereatsSnapshot = await buildUberEatsOpsDocument(userKey);
    if (ubereatsSnapshot.document) {
      analysisDocuments.unshift(ubereatsSnapshot.document);
    }
    ubereatsWarning = ubereatsSnapshot.warning;
  }

  const result = businessTarget
    ? await runBusinessIntelAnalysis({
        target: businessTarget,
        sortBy: parsed.data.sortBy,
        compareMode: parsed.data.compareMode,
        uploadedDocuments: analysisDocuments,
      })
    : await orchestrateRestaurantAnalysis({
        restaurantConfig: parsed.data.restaurantConfig,
        sortBy: parsed.data.sortBy,
        uploadedDocuments: analysisDocuments,
        userKey,
      });

  const mergedWarning = [result.warning, ubereatsWarning].filter(Boolean).join(' ');
  const nextResult = {
    ...result,
    warning: mergedWarning || undefined,
  };

  if (userId) {
    await savePersistedAnalysisRuntimeState(userId, {
      analysis: nextResult,
      uploadedDocuments: analysisDocuments,
      updatedAt: new Date().toISOString(),
    });
  }

  if (!businessTarget && appEnv.useMockData && !analysisDocuments.length) {
    return NextResponse.json({
      ...nextResult,
      source: nextResult.source === 'live' ? 'fallback' : nextResult.source,
      warning:
        nextResult.warning ||
        'Mock mode is enabled. Live external adapters remain disabled unless upload-driven analysis is provided.',
    });
  }

  return NextResponse.json(nextResult);
}
