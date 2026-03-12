import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mockAnalysisResponse } from '@/lib/mock-data';
import { loadPersistedAnalysisRuntimeState } from '@/lib/server/analysis-runtime-store';
import { generateDailyBriefing } from '@/lib/server/daily-briefing';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const language = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'zh';

  const runtime = userId ? await loadPersistedAnalysisRuntimeState(userId) : null;
  const analysis = runtime?.analysis ?? mockAnalysisResponse;
  const uploadedDocuments = runtime?.uploadedDocuments ?? [];

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

