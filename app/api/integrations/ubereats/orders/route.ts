import { NextRequest, NextResponse } from 'next/server';
import { getUberEatsClient } from '@/lib/server/integrations/ubereats/client';
import { getIntegrationTokens } from '@/lib/server/integration-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const tokens = await getIntegrationTokens('ubereats');

    if (!tokens?.accessToken) {
      return NextResponse.json(
        { error: 'UberEats not connected', connected: false },
        { status: 401 }
      );
    }

    const client = getUberEatsClient();
    client.setAccessToken(tokens.accessToken);

    // 获取店铺列表
    const stores = await client.getStores();

    if (!stores.length) {
      return NextResponse.json({
        connected: true,
        stores: [],
        orders: [],
        message: 'No stores found for this account',
      });
    }

    // 获取第一个店铺的订单
    const storeId = stores[0].store_id;
    const orders = await client.getOrders(storeId, 'active');

    return NextResponse.json({
      connected: true,
      stores,
      orders,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[UberEats Orders] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch UberEats orders', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orderId, ...params } = body as {
      action: 'accept' | 'deny' | 'ready';
      orderId: string;
      readyTime?: number;
      reason?: string;
    };

    const tokens = await getIntegrationTokens('ubereats');
    if (!tokens?.accessToken) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const client = getUberEatsClient();
    client.setAccessToken(tokens.accessToken);

    switch (action) {
      case 'accept':
        await client.acceptOrder(orderId, params.readyTime);
        return NextResponse.json({ success: true, action: 'accepted' });

      case 'deny':
        await client.denyOrder(orderId, params.reason ?? 'denied_by_store');
        return NextResponse.json({ success: true, action: 'denied' });

      case 'ready':
        await client.markOrderReady(orderId);
        return NextResponse.json({ success: true, action: 'marked_ready' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[UberEats Orders POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to perform action', details: String(error) },
      { status: 500 }
    );
  }
}

