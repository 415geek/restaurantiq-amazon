import { NextRequest, NextResponse } from 'next/server';
import { scanCompetitors, monitorReviews, checkNovaActConfig } from '@/lib/server/nova-act/client';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ScanRequest = {
  action: 'scan_competitors' | 'monitor_reviews' | 'check_config';
  platform?: 'doordash' | 'ubereats' | 'grubhub' | 'hungrypanda' | 'fantuan' | 'google' | 'yelp' | 'xiaohongshu';
  query?: string;
  address?: string;
  businessName?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScanRequest;
    const { action, platform, query, address, businessName } = body;

    if (action === 'check_config') {
      const config = checkNovaActConfig();
      return NextResponse.json(config);
    }

    if (action === 'scan_competitors') {
      if (!platform || !query || !address) {
        return NextResponse.json(
          { error: 'Missing required fields: platform, query, address' },
          { status: 400 }
        );
      }

      if (!['doordash', 'ubereats', 'grubhub', 'hungrypanda', 'fantuan'].includes(platform)) {
        return NextResponse.json(
          { error: 'Invalid platform for competitor scan' },
          { status: 400 }
        );
      }

      const results = await scanCompetitors(
        platform as 'doordash' | 'ubereats' | 'grubhub' | 'hungrypanda' | 'fantuan',
        query,
        address
      );

      return NextResponse.json({
        success: true,
        action: 'scan_competitors',
        platform,
        query,
        results,
        isMockData: process.env.AWS_NOVA_ACT_ENABLED !== 'true',
      });
    }

    if (action === 'monitor_reviews') {
      if (!platform || !businessName) {
        return NextResponse.json(
          { error: 'Missing required fields: platform, businessName' },
          { status: 400 }
        );
      }

      if (!['google', 'yelp', 'xiaohongshu'].includes(platform)) {
        return NextResponse.json(
          { error: 'Invalid platform for review monitoring' },
          { status: 400 }
        );
      }

      const results = await monitorReviews(
        platform as 'google' | 'yelp' | 'xiaohongshu',
        businessName
      );

      return NextResponse.json({
        success: true,
        action: 'monitor_reviews',
        platform,
        businessName,
        results,
        isMockData: process.env.AWS_NOVA_ACT_ENABLED !== 'true',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: scan_competitors, monitor_reviews, or check_config' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Nova Act API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const config = checkNovaActConfig();
  return NextResponse.json({
    name: 'Nova Act API',
    version: '1.0.0',
    status: config.configured ? 'ready' : 'demo_mode',
    message: config.message,
    endpoints: {
      POST: {
        'scan_competitors': 'Scan competitor restaurants on delivery platforms',
        'monitor_reviews': 'Monitor reviews on Google/Yelp/Xiaohongshu',
        'check_config': 'Check Nova Act configuration status',
      },
    },
  });
}
