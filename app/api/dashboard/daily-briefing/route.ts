import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mockAnalysisResponse } from '@/lib/mock-data';
import { loadPersistedAnalysisRuntimeState } from '@/lib/server/analysis-runtime-store';
import { generateDailyBriefing } from '@/lib/server/daily-briefing';
import { buildDemoMockOpsDocuments } from '@/lib/server/demo-mock-documents';
import { getDemoIdFromRequest } from '@/lib/server/demo-session';

export async function GET(req: NextRequest) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  const isDemo = Boolean(demoId);

  const { userId } = await auth();
  const language = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'zh';

  const runtime = !isDemo && userId ? await loadPersistedAnalysisRuntimeState(userId) : null;
  const analysis = isDemo ? mockAnalysisResponse : runtime?.analysis ?? mockAnalysisResponse;
  const uploadedDocuments = isDemo ? buildDemoMockOpsDocuments() : runtime?.uploadedDocuments ?? [];

  const result = await generateDailyBriefing({
    analysis,
    uploadedDocuments,
    lang: language,
  });

  return NextResponse.json({
    source: result.source,
    warning: result.warning,
    briefing: result.result.briefing,
    highlights: result.result.highlights,
    generatedAt: new Date().toISOString(),
  });
}