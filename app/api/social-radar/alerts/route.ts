import { NextResponse } from 'next/server';
import { createSocialRadarService } from '@/lib/server/social-radar/service';
import { loadSocialRadarConfig } from '@/lib/server/social-radar/config-store';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const config = await loadSocialRadarConfig();
    const service = createSocialRadarService(config);
    const alerts = await service.generateAlerts();

    return NextResponse.json({
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Social Radar Alerts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate alerts' },
      { status: 500 }
    );
  }
}

