import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { loadDeliveryManagementState, saveDeliveryManagementState } from '@/lib/server/delivery-management-store';
import { getUberEatsConnectionState } from '@/lib/server/ubereats-oauth-store';
import { resolveUberEatsAccessToken } from '@/lib/server/ubereats-token';
import { computeBranchEffectiveMenu } from '@/lib/server/menu-branches';
import { getDemoIdFromRequest, demoUserKey } from '@/lib/server/demo-session';
import type { DeliveryPlatformKey } from '@/lib/delivery-management-types';

export const runtime = 'nodejs';

const bodySchema = z.object({
  menuId: z.string().optional(),
  platforms: z
    .array(z.enum(['ubereats', 'doordash', 'grubhub', 'fantuan', 'hungrypanda']))
    .optional(),
  itemIds: z.array(z.string()).optional(),
});

type PlatformSyncResult = {
  platform: string;
  success: boolean;
  syncedCount: number;
  error?: string;
  warning?: string;
};

function resolveUserKey(req: NextRequest, userId: string | null) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  if (demoId) return demoUserKey(demoId);
  return userId ?? 'anonymous';
}

async function syncToUberEats(
  items: Array<{ id: string; name: string; basePrice: number; category: string; channels: Record<string, any> }>,
  userKey: string,
  platformConfig: any
): Promise<PlatformSyncResult> {
  const token = (await resolveUberEatsAccessToken(userKey)).token;
  const endpoint = process.env.UBEREATS_MENU_MUTATION_ENDPOINT;

  if (!token) {
    return {
      platform: 'ubereats',
      success: false,
      syncedCount: 0,
      error: 'Uber Eats token missing. Complete OAuth or configure UBEREATS_BEARER_TOKEN.',
    };
  }

  if (!endpoint) {
    return {
      platform: 'ubereats',
      success: false,
      syncedCount: 0,
      warning: 'UBEREATS_MENU_MUTATION_ENDPOINT not configured. Menu saved locally only.',
    };
  }

  // Filter items that are enabled for Uber Eats
  const itemsToSync = items.filter(item => item.channels.ubereats?.enabled);

  if (itemsToSync.length === 0) {
    return {
      platform: 'ubereats',
      success: true,
      syncedCount: 0,
      warning: 'No items enabled for Uber Eats.',
    };
  }

  try {
    // Build Uber Eats menu mutation payload
    // Note: This is a simplified version. Actual Uber Eats menu API has more complex structure
    const payload = {
      store_id: platformConfig?.stores?.[0]?.id || process.env.UBEREATS_STORE_IDS?.split(',')[0],
      menus: [{
        id: 'menu-1',
        title: 'Restaurant Menu',
        category_ids: itemsToSync.map(item => `cat-${item.category.toLowerCase().replace(/\s+/g, '-')}`),
        items: itemsToSync.map((item, index) => ({
          id: `item-${index}`,
          name: item.name,
          description: item.name,
          price: item.basePrice,
          quantity_info: {
            min: 0,
            max: 100,
            is_available: true,
          },
        })),
      }],
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        platform: 'ubereats',
        success: false,
        syncedCount: 0,
        error: `Uber Eats API error (${response.status}): ${JSON.stringify(errorData)}`,
      };
    }

    await response.json().catch(() => null);
    return {
      platform: 'ubereats',
      success: true,
      syncedCount: itemsToSync.length,
    };
  } catch (error) {
    return {
      platform: 'ubereats',
      success: false,
      syncedCount: 0,
      error: `Failed to sync to Uber Eats: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function syncToPlatform(
  platform: 'ubereats' | 'doordash' | 'grubhub' | 'fantuan' | 'hungrypanda',
  items: Array<{ id: string; name: string; basePrice: number; category: string; channels: Record<string, any> }>,
  userKey: string
): Promise<PlatformSyncResult> {
  const state = await loadDeliveryManagementState(userKey);
  const platformConfig = platform === 'ubereats' ? getUberEatsConnectionState(userKey) : null;

  // For now, only Uber Eats has implemented sync
  if (platform === 'ubereats') {
    return await syncToUberEats(items, userKey, platformConfig);
  }

  // Other platforms would have their own sync implementations
  return {
    platform,
    success: false,
    syncedCount: 0,
    warning: `${platform} sync not yet implemented. Menu saved locally only.`,
  };
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const userKey = resolveUserKey(req, userId);

  try {
    const payload = await req.json();
    const parsed = bodySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid request payload',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const state = await loadDeliveryManagementState(userKey);

    const menuId = parsed.data.menuId || 'default';
    const branch = menuId === 'default' ? null : state.menuBranches.find((m) => m.id === menuId) || null;

    const allItems = branch
      ? computeBranchEffectiveMenu({ defaultMenu: state.menu, branch })
      : state.menu;

    const requestedPlatforms: DeliveryPlatformKey[] = parsed.data.platforms
      ? (parsed.data.platforms as DeliveryPlatformKey[])
      : (branch
          ? (branch.platforms.filter((p) => p !== 'pos') as DeliveryPlatformKey[])
          : (state.platforms
              .filter((p) => p.status === 'connected')
              .map((p) => p.key) as DeliveryPlatformKey[]));

    if (!requestedPlatforms.length) {
      return NextResponse.json(
        { ok: false, error: 'no_platforms_selected' },
        { status: 400 }
      );
    }

    // Filter items to sync
    const itemsToSync = parsed.data.itemIds
      ? allItems.filter(item => parsed.data.itemIds!.includes(item.id))
      : allItems.filter(item => {
          // Sync items that are enabled for any of the requested platforms
          return requestedPlatforms.some(platform => item.channels[platform]?.enabled);
        });

    // Sync to each platform
    const syncPromises = requestedPlatforms.map(platform =>
      syncToPlatform(platform as any, itemsToSync, userKey)
    );

    const results = await Promise.all(syncPromises);

    // Calculate final state
    const successfulSyncs = results.filter(r => r.success);
    const totalSynced = successfulSyncs.reduce((sum, r) => sum + r.syncedCount, 0);

    // Update last synced time for successful platforms
    const syncTime = new Date().toISOString();
    const nextState = {
      ...state,
      lastPublishedAt: syncTime,
      platforms: state.platforms.map(platform => {
        const platformResult = results.find(r => r.platform === platform.key);
        if (platformResult?.success) {
          return {
            ...platform,
            menuSyncedAt: syncTime,
          };
        }
        return platform;
      }),
    };

    await saveDeliveryManagementState(userKey, nextState);

    return NextResponse.json({
      ok: true,
      menuId,
      results,
      totalSynced,
      totalRequestedPlatforms: requestedPlatforms.length,
      timestamp: syncTime,
    });
  } catch (error) {
    console.error('[Menu Sync] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}