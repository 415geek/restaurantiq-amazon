import { NextRequest, NextResponse } from 'next/server';
import { createCompetitorAnalysisService } from '@/lib/server/nova-act/competitor-analysis';

export const runtime = 'nodejs';
export const maxDuration = 180; // 3分钟超时

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { myMenu, platforms, location } = body as {
      myMenu: Array<{ name: string; price: number; category: string }>;
      platforms?: string[];
      location?: string;
    };

    if (!myMenu || !Array.isArray(myMenu)) {
      return NextResponse.json(
        { error: 'myMenu array is required' },
        { status: 400 }
      );
    }

    const service = createCompetitorAnalysisService();
    const analysis = await service.runFullAnalysis(
      myMenu,
      platforms || ['doordash', 'ubereats'],
      location || 'San Francisco, CA'
    );

    return NextResponse.json({
      success: true,
      ...analysis,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Nova Act Analyze] Error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: String(error) },
      { status: 500 }
    );
  }
}

