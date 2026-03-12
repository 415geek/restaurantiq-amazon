import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { DeliveryPlatformKey } from '@/lib/delivery-management-types';
import {
  loadDeliveryManagementState,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';
import { clearUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';

const UBEREATS_CONNECTION_COOKIE = 'ubereats_connection';

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

  const { userId } = await auth();
  const userKey = userId ?? 'anonymous';
  const state = await loadDeliveryManagementState(userKey);

  state.platforms = state.platforms.map((row) =>
    row.key === platform
      ? {
          ...row,
          status: 'not_connected',
          acceptsOrders: false,
          queueSize: 0,
          avgPrepMins: 0,
          menuSyncedAt: undefined,
        }
      : row
  );

  state.onboarding.platformStates = state.onboarding.platformStates.map((row) =>
    row.key === platform
      ? {
          ...row,
          authStatus: 'not_started',
          syncStatus: 'idle',
          lastSyncAt: undefined,
          note: 'Disconnected from Settings Integrations',
        }
      : row
  );

  await saveDeliveryManagementState(userKey, state);

  const response = NextResponse.redirect(
    buildRedirect(appUrl, {
      delivery_platform: platform,
      delivery_status: 'disconnected',
      delivery_mode: 'integration_settings',
    })
  );

  if (platform === 'ubereats') {
    clearUberEatsConnectionState(userKey);
    response.cookies.delete(UBEREATS_CONNECTION_COOKIE);
  }

  return response;
}
