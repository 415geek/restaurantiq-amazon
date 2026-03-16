import { NextRequest, NextResponse } from 'next/server';
import { createSocialRadarService } from '@/lib/server/social-radar/service';
import { loadSocialRadarConfig } from '@/lib/server/social-radar/config-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const config = await loadSocialRadarConfig();

    if (!config.googlePlaceId && !config.yelpBusinessId) {
      return NextResponse.json({
        configured: false,
        message:
          'No social platforms configured. Add Google Place ID or Yelp Business ID in settings.',
        reviews: [],
        summaries: [],
      });
    }

    const service = createSocialRadarService(config);
    const result = await service.fetchAllReviews();

    return NextResponse.json({
      configured: true,
      ...result,
    });
  } catch (error) {
    console.error('[Social Radar] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews', details: String(error) },
      { status: 500 }
    );
  }
}

