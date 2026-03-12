import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UberEatsTokenService } from '../ubereats/ubereats-token.service';

type DeliveryOrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

@Injectable()
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private uberEatsTokenService: UberEatsTokenService,
  ) {}

  /**
   * Get orders with filters
   */
  async getOrders(filters: {
    tenantId: string;
    platform?: string;
    status?: DeliveryOrderStatus;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {
      tenantId: filters.tenantId,
    };

    if (filters.platform) {
      where.platform = filters.platform.toUpperCase();
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.from || filters.to) {
      where.placedAt = {};
      if (filters.from) {
        where.placedAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.placedAt.lte = new Date(filters.to);
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    };
  }

  /**
   * Get order by ID
   */
  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  /**
   * Accept order
   */
  async acceptOrder(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (order.status !== 'new') {
      throw new Error('Order cannot be accepted in current status');
    }

    // Call platform API to accept order
    await this.callPlatformAction(order.platform, order.platformOrderId, 'accept');

    // Update order status
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Start preparation
   */
  async startPrep(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (order.status !== 'accepted') {
      throw new Error('Order cannot be started in current status');
    }

    // Call platform API to start preparation
    await this.callPlatformAction(order.platform, order.platformOrderId, 'start_prep');

    // Update order status
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'preparing',
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Mark order as ready
   */
  async markReady(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (order.status !== 'preparing') {
      throw new Error('Order cannot be marked ready in current status');
    }

    // Call platform API to mark ready
    await this.callPlatformAction(order.platform, order.platformOrderId, 'ready');

    // Update order status
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'ready',
        readyAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Complete order
   */
  async completeOrder(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (order.status !== 'ready') {
      throw new Error('Order cannot be completed in current status');
    }

    // Call platform API to complete order
    await this.callPlatformAction(order.platform, order.platformOrderId, 'complete');

    // Update order status
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Cancel order
   */
  async cancelOrder(id: string, tenantId: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new Error('Order cannot be cancelled in current status');
    }

    // Call platform API to cancel order
    await this.callPlatformAction(order.platform, order.platformOrderId, 'cancel', { reason });

    // Update order status
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Call platform API for order actions
   */
  private async callPlatformAction(
    platform: string,
    platformOrderId: string,
    action: string,
    data?: any,
  ): Promise<void> {
    switch (platform) {
      case 'UBEREATS':
        await this.callUberEatsAction(platformOrderId, action, data);
        break;
      case 'DOORDASH':
        // TODO: Implement DoorDash API
        break;
      case 'GRUBHUB':
        // TODO: Implement GrubHub API
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Call Uber Eats API for order actions
   */
  private async callUberEatsAction(
    platformOrderId: string,
    action: string,
    data?: any,
  ): Promise<void> {
    // TODO: Get tenantId from context
    const tenantId = 'default-tenant';

    // Get access token
    const { token } = await this.uberEatsTokenService.resolveAccessToken(tenantId);
    if (!token) {
      throw new Error('Failed to get Uber Eats access token');
    }

    const apiBaseUrl = this.getUberEatsApiBaseUrl();
    const storeId = this.getUberEatsStoreId();

    let endpoint = '';
    let method = 'POST';
    let body: any = {};

    switch (action) {
      case 'accept':
        endpoint = `/v1/eats/stores/${storeId}/orders/${platformOrderId}/accept`;
        break;
      case 'start_prep':
        endpoint = `/v1/eats/stores/${storeId}/orders/${platformOrderId}/accept`;
        body = { status: 'preparing' };
        break;
      case 'ready':
        endpoint = `/v1/eats/stores/${storeId}/orders/${platformOrderId}/accept`;
        body = { status: 'ready' };
        break;
      case 'complete':
        endpoint = `/v1/eats/stores/${storeId}/orders/${platformOrderId}/accept`;
        body = { status: 'completed' };
        break;
      case 'cancel':
        endpoint = `/v1/eats/stores/${storeId}/orders/${platformOrderId}/cancel`;
        body = { reason: data?.reason || 'Restaurant cancelled' };
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Uber Eats API error: ${response.status} - ${errorText}`);
      }

      console.log(`[Uber Eats API] ${action} successful for order ${platformOrderId}`);
    } catch (error) {
      console.error(`[Uber Eats API] ${action} failed for order ${platformOrderId}:`, error);
      throw error;
    }
  }

  private getUberEatsApiBaseUrl(): string {
    const env = process.env.UBEREATS_ENVIRONMENT || 'sandbox';
    return env === 'production'
      ? 'https://api.uber.com'
      : 'https://sandbox-api.uber.com';
  }

  private getUberEatsStoreId(): string {
    return process.env.UBEREATS_STORE_IDS || '';
  }
}