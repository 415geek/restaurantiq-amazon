import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { appEnv } from '@/lib/env';
import { orchestrateRestaurantAnalysis } from '@/lib/server/orchestration/analysis-orchestrator';
import { runBusinessIntelAnalysis } from '@/lib/server/business-intel-analysis';
import { savePersistedAnalysisRuntimeState } from '@/lib/server/analysis-runtime-store';
import { buildUberEatsOpsDocument } from '@/lib/server/adapters/ubereats-ops';
import { buildDemoMockOpsDocuments } from '@/lib/server/demo-mock-documents';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';
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
  if (!entries.length) return undefined;
  return Object.fromEntries(entries);
}

function normalizeStructuredPreview(value: unknown): UploadedOpsDocument['structuredPreview'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const format = VALID_FORMATS.has(record.format as StructuredPreview['format'])
    ? (record.format as StructuredPreview['format'])
    : 'text';
  const sourceType = VALID_SOURCE_TYPES.has(record.sourceType as StructuredPreview['sourceType'])
    ? (record.sourceType as StructuredPreview['sourceType'])
    : undefined;
  const inferredTimeGrain = VALID_TIME_GRAINS.has(record.inferredTimeGrain as StructuredPreview['inferredTimeGrain'])
    ? (record.inferredTimeGrain as StructuredPreview['inferredTimeGrain'])
    : undefined;

  return {
    format,
    sourceType,
    rowCount: typeof record.rowCount === 'number' ? record.rowCount : undefined,
    columns: asStringArray(record.columns),
    sampleValues: typeof record.sampleValues === 'object' && record.sampleValues && !Array.isArray(record.sampleValues)
      ? Object.fromEntries(
          Object.entries(record.sampleValues as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string')
            .map(([k, v]) => [k, v as string])
        )
      : undefined,
    numericMetrics: asNumberRecord(record.numericMetrics),
    canonicalMetrics: asNumberRecord(record.canonicalMetrics),
    businessMetrics:
      typeof record.businessMetrics === 'object' && record.businessMetrics && !Array.isArray(record.businessMetrics)
        ? (record.businessMetrics as StructuredPreview['businessMetrics'])
        : undefined,
    platformBreakdown:
      typeof record.platformBreakdown === 'object' && record.platformBreakdown && !Array.isArray(record.platformBreakdown)
        ? (record.platformBreakdown as StructuredPreview['platformBreakdown'])
        : undefined,
    orderTypeBreakdown:
      typeof record.orderTypeBreakdown === 'object' && record.orderTypeBreakdown && !Array.isArray(record.orderTypeBreakdown)
        ? (record.orderTypeBreakdown as StructuredPreview['orderTypeBreakdown'])
        : undefined,
    dateStats:
      typeof record.dateStats === 'object' && record.dateStats && !Array.isArray(record.dateStats)
        ? (record.dateStats as StructuredPreview['dateStats'])
        : undefined,
    dateRange:
      typeof record.dateRange === 'object' && record.dateRange && !Array.isArray(record.dateRange)
        ? (record.dateRange as StructuredPreview['dateRange'])
        : undefined,
    detectedKeywords: asStringArray(record.detectedKeywords),
    datasetHints: asStringArray(record.datasetHints),
    rowSample:
      Array.isArray(record.rowSample)
        ? (record.rowSample as Array<Record<string, string>>)
        : undefined,
    qualityFlags: asStringArray(record.qualityFlags),
    parserConfidence:
      typeof record.parserConfidence === 'number' ? record.parserConfidence : undefined,
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

  const extractedText = asString(value.extractedText);
  const excerpt = asString(value.excerpt, extractedText.slice(0, 280));

  return {
    id: asString(value.id, `uploaded-${index}`),
    fileName: asString(value.fileName, `uploaded-${index}`),
    mimeType: asString(value.mimeType, 'text/plain'),
    size: asNumber(value.size, extractedText.length),
    category,
    parsingStatus,
    source,
    extractedText,
    excerpt,
    cleaningActions: asStringArray(value.cleaningActions),
    structuredPreview: normalizeStructuredPreview(value.structuredPreview),
    uploadedAt: asString(value.uploadedAt, new Date().toISOString()),
  };
}

function normalizeBusinessTarget(target: unknown) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return null;
  const value = target as Record<string, unknown>;
  if (typeof value.name !== 'string' || typeof value.address !== 'string') return null;
  return {
    name: value.name.trim(),
    address: value.address.trim(),
    googlePlaceId: typeof value.googlePlaceId === 'string' ? value.googlePlaceId.trim() : undefined,
    yelpBusinessId: typeof value.yelpBusinessId === 'string' ? value.yelpBusinessId.trim() : undefined,
    lat: typeof value.lat === 'number' ? value.lat : undefined,
    lng: typeof value.lng === 'number' ? value.lng : undefined,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid analysis request payload.' }, { status: 400 });
  }

  const demoId = getDemoIdFromRequest({ headers: req.headers });
  const isDemo = Boolean(demoId);

  const uploadedDocuments = (parsed.data.uploadedDocuments ?? []).map(normalizeUploadedDocument);
  const businessTarget = normalizeBusinessTarget(parsed.data.businessTarget);
  const { userId } = await auth();
  const userKey = isDemo && demoId ? demoUserKey(demoId) : (userId ?? 'anonymous');

  let ubereatsWarning: string | undefined;
  const analysisDocuments = uploadedDocuments.filter((doc) => doc.source !== 'ubereats_api');

  if (!businessTarget) {
    if (isDemo) {
      if (!analysisDocuments.length) {
        analysisDocuments.unshift(...buildDemoMockOpsDocuments());
      }
    } else {
      const ubereatsSnapshot = await buildUberEatsOpsDocument(userKey);
      if (ubereatsSnapshot.document) {
        analysisDocuments.unshift(ubereatsSnapshot.document);
      }
      ubereatsWarning = ubereatsSnapshot.warning;
    }
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

  const mergedWarning = [result.warning, ubereatsWarning]
    .filter(Boolean)
    .concat(isDemo ? ['Demo mode: operating data uses mock datasets.'] : [])
    .join(' ');
  const nextResult = {
    ...result,
    warning: mergedWarning || undefined,
  };

  if (userId && !isDemo) {
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