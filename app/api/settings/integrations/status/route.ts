import { NextResponse } from 'next/server';
import { isIntegrationConnected } from '@/lib/server/integration-store';
import { isUberEatsConfigured } from '@/lib/server/integrations/ubereats/client';

export const runtime = 'nodejs';

export async function GET() {
  const integrations = {
    ubereats: {
      configured: isUberEatsConfigured(),
      connected: await isIntegrationConnected('ubereats'),
      authUrl: '/api/integrations/ubereats/authorize',
    },
    doordash: {
      configured: Boolean(process.env.DOORDASH_DEVELOPER_ID),
      connected: await isIntegrationConnected('doordash'),
      authUrl: '/api/integrations/doordash/authorize',
    },
    // ... 其他集成
  };

  return NextResponse.json(integrations);
}

