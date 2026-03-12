import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { DeliveryPlatformKey } from '@/lib/delivery-management-types';
import {
  loadDeliveryManagementState,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';

const SUPPORTED_PLATFORMS: DeliveryPlatformKey[] = [
  'ubereats',
  'doordash',
  'grubhub',
  'fantuan',
  'hungrypanda',
];

function buildRedirect(appUrl: string, params: Record<string, string>) {
  const out = new URL('/delivery', appUrl);
  for (const [key, value] of Object.entries(params)) out.searchParams.set(key, value);
  return out;
}

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const platform = req.nextUrl.searchParams.get('platform') as DeliveryPlatformKey | null;
  if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
    return NextResponse.redirect(
      buildRedirect(appUrl, {
        delivery_status: 'error',
        delivery_error: 'invalid_platform',
      })
    );
  }

  if (platform === 'ubereats') {
    return NextResponse.redirect(
      new URL('/api/integrations/ubereats/start?next=%2Fdelivery', appUrl)
    );
  }

  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const state = await loadDeliveryManagementState(userKey);
  const now = new Date().toISOString();

  state.platforms = state.platforms.map((row) =>
    row.key === platform
      ? {
          ...row,
          status: 'connected',
          acceptsOrders: true,
          queueSize: row.queueSize || 0,
          avgPrepMins: row.avgPrepMins || 20,
          menuSyncedAt: now,
        }
      : row
  );

  state.onboarding.platformStates = state.onboarding.platformStates.map((row) =>
    row.key === platform
      ? {
          ...row,
          accessRequestStatus: 'approved',
          authStatus: 'connected',
          syncStatus: 'synced',
          lastSyncAt: now,
          note: 'Connected from Settings Integrations',
        }
      : row
  );

  state.onboarding.checklist.authorizationCompleted = true;
  state.onboarding.checklist.initialSyncCompleted = true;

  await saveDeliveryManagementState(userKey, state);

  return NextResponse.redirect(
    buildRedirect(appUrl, {
      delivery_platform: platform,
      delivery_status: 'connected',
      delivery_mode: 'integration_settings',
    })
  );
}
