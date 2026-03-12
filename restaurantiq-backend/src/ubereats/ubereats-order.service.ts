import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UberEatsService } from './ubereats.service';
import { DeliveryGateway } from '../delivery/delivery.gateway';

export interface UberEatsOrderPayload {
  order_id: string;
  display_id: string;
  status: string;
  created_at: string;
  customer: {
    first_name: string;
    last_name: string;
  };
  cart: {
    items: Array<{
      name: string;
      quantity: number;
      price: {
        amount: number;
        currency: string;
      };
    }>;
    subtotal: {
      amount: number;
      currency: string;
    };
    tax: {
      amount: number;
      currency: string;
    };
    delivery_fee: {
      amount: number;
      currency: string;
    };
    tip: {
      amount: number;
      currency: string;
    };
    total: {
      amount: number;
      currency: string;
    };
  };
  delivery: {
    dropoff: {
      location: {
        address: {
          street_address: string;
          city: string;
          state: string;
          postal_code: string;
        };
      };
    };
    estimated_delivery_time?: string;
  };
  notes?: string;
}

@Injectable()
export class UberEatsOrderService {
  private readonly logger = new Logger(UberEatsOrderService.name);

  constructor(
    private prisma: PrismaService,
    private uberEatsService: UberEatsService,
    private deliveryGateway: DeliveryGateway,
  ) {
    this.logger.log('[Uber Eats Order Service] Initialized');
  }

  /**
   * Parse and normalize Uber Eats order payload
   */
  parseOrderPayload(payload: UberEatsOrderPayload): any {
    const items = payload.cart.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price.amount,
    }));

    return {
      platformOrderId: payload.order_id,
      displayOrderId: payload.display_id,
      status: this.mapStatus(payload.status),
      customerName: `${payload.customer.first_name} ${payload.customer.last_name}`.trim() || 'Unknown',
      items,
      subtotal: payload.cart.subtotal.amount,
      tax: payload.cart.tax?.amount || 0,
      deliveryFee: payload.cart.delivery_fee?.amount || 0,
      tip: payload.cart.tip?.amount || 0,
      total: payload.cart.total.amount,
      notes: payload.notes || null,
      etaMins: this.calculateEta(payload.delivery.estimated_delivery_time),
      placedAt: new Date(payload.created_at),
      rawPayload: payload,
    };
  }

  /**
   * Map Uber Eats status to internal status
   */
  private mapStatus(uberStatus: string): string {
    const statusMap: Record<string, string> = {
      'new': 'NEW',
      'accepted': 'ACCEPTED',
      'preparing': 'PREPARING',
      'ready_for_pickup': 'READY',
      'driver_at_pickup': 'READY',
      'on_the_way': 'READY',
      'delivered': 'COMPLETED',
      'cancelled': 'CANCELLED',
      'rejected': 'CANCELLED',
    };

    return statusMap[uberStatus] || 'NEW';
  }

  /**
   * Calculate ETA in minutes
   */
  private calculateEta(estimatedTime?: string): number {
    if (!estimatedTime) return 0;

    try {
      const eta = new Date(estimatedTime);
      const now = new Date();
      const diffMs = eta.getTime() - now.getTime();
      return Math.max(0, Math.floor(diffMs / 60000)); // Convert to minutes
    } catch (error) {
      this.logger.error('[Uber Eats Order Service] Failed to calculate ETA', { error });
      return 0;
    }
  }

  /**
   * Save order to database
   */
  async saveOrder(tenantId: string, restaurantId: string, payload: UberEatsOrderPayload): Promise<any> {
    const normalizedOrder = this.parseOrderPayload(payload);

    try {
      const order = await this.prisma.order.upsert({
        where: {
          platform_platformOrderId: {
            platform: 'UBEREATS',
            platformOrderId: normalizedOrder.platformOrderId,
          },
        },
        create: {
          tenantId,
          restaurantId,
          platform: 'UBEREATS',
          platformOrderId: normalizedOrder.platformOrderId,
          displayOrderId: normalizedOrder.displayOrderId,
          status: normalizedOrder.status,
          customerName: normalizedOrder.customerName,
          items: normalizedOrder.items,
          subtotal: normalizedOrder.subtotal,
          tax: normalizedOrder.tax,
          deliveryFee: normalizedOrder.deliveryFee,
          tip: normalizedOrder.tip,
          total: normalizedOrder.total,
          notes: normalizedOrder.notes,
          etaMins: normalizedOrder.etaMins,
          placedAt: normalizedOrder.placedAt,
          rawPayload: normalizedOrder.rawPayload,
          source: 'WEBHOOK',
        },
        update: {
          status: normalizedOrder.status,
          notes: normalizedOrder.notes,
          etaMins: normalizedOrder.etaMins,
          rawPayload: normalizedOrder.rawPayload,
          updatedAt: new Date(),
        },
      });

      this.logger.log('[Uber Eats Order Service] Order saved', {
        orderId: order.id,
        platformOrderId: order.platformOrderId,
        status: order.status,
      });

      return order;
    } catch (error: any) {
      this.logger.error('[Uber Eats Order Service] Failed to save order', {
        error: error.message,
        platformOrderId: normalizedOrder.platformOrderId,
      });
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    tenantId: string,
    platformOrderId: string,
    status: string,
    payload?: any,
  ): Promise<any> {
    try {
      const order = await this.prisma.order.updateMany({
        where: {
          tenantId,
          platform: 'UBEREATS',
          platformOrderId,
        },
        data: {
          status: this.mapStatus(status),
          rawPayload: payload,
          updatedAt: new Date(),
        },
      });

      this.logger.log('[Uber Eats Order Service] Order status updated', {
        platformOrderId,
        status,
        count: order.count,
      });

      return order;
    } catch (error: any) {
      this.logger.error('[Uber Eats Order Service] Failed to update order status', {
        error: error.message,
        platformOrderId,
        status,
      });
      throw error;
    }
  }

  /**
   * Get order by platform order ID
   */
  async getOrderByPlatformId(tenantId: string, platformOrderId: string): Promise<any> {
    return this.prisma.order.findFirst({
      where: {
        tenantId,
        platform: 'UBEREATS',
        platformOrderId,
      },
    });
  }

  /**
   * Get recent orders
   */
  async getRecentOrders(tenantId: string, limit: number = 50): Promise<any[]> {
    return this.prisma.order.findMany({
      where: {
        tenantId,
        platform: 'UBEREATS',
      },
      orderBy: {
        placedAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(tenantId: string, status: string): Promise<any[]> {
    return this.prisma.order.findMany({
      where: {
        tenantId,
        platform: 'UBEREATS',
        status,
      },
      orderBy: {
        placedAt: 'desc',
      },
    });
  }

  /**
   * Accept order on Uber Eats platform
   */
  async acceptOrder(tenantId: string, platformOrderId: string): Promise<void> {
    try {
      await this.uberEatsService.makeAuthenticatedRequest(
        tenantId,
        'POST',
        `/v1/eats/orders/${platformOrderId}/accept`,
      );

      // Update local status
      await this.updateOrderStatus(tenantId, platformOrderId, 'accepted');

      this.logger.log('[Uber Eats Order Service] Order accepted', { platformOrderId });
    } catch (error: any) {
      this.logger.error('[Uber Eats Order Service] Failed to accept order', {
        error: error.message,
        platformOrderId,
      });
      throw error;
    }
  }

  /**
   * Cancel order on Uber Eats platform
   */
  async cancelOrder(
    tenantId: string,
    platformOrderId: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.uberEatsService.makeAuthenticatedRequest(
        tenantId,
        'POST',
        `/v1/eats/orders/${platformOrderId}/cancel`,
        { reason },
      );

      // Update local status
      await this.updateOrderStatus(tenantId, platformOrderId, 'cancelled');

      this.logger.log('[Uber Eats Order Service] Order cancelled', {
        platformOrderId,
        reason,
      });
    } catch (error: any) {
      this.logger.error('[Uber Eats Order Service] Failed to cancel order', {
        error: error.message,
        platformOrderId,
        reason,
      });
      throw error;
    }
  }

  /**
   * Update order status on Uber Eats platform
   */
  async updateOrderStatusOnPlatform(
    tenantId: string,
    platformOrderId: string,
    status: 'preparing' | 'ready_for_pickup' | 'driver_at_pickup',
  ): Promise<void> {
    try {
      await this.uberEatsService.makeAuthenticatedRequest(
        tenantId,
        'POST',
        `/v1/eats/orders/${platformOrderId}/status`,
        { status },
      );

      // Update local status
      await this.updateOrderStatus(tenantId, platformOrderId, status);

      this.logger.log('[Uber Eats Order Service] Order status updated on platform', {
        platformOrderId,
        status,
      });
    } catch (error: any) {
      this.logger.error('[Uber Eats Order Service] Failed to update order status on platform', {
        error: error.message,
        platformOrderId,
        status,
      });
      throw error;
    }
  }

  /**
   * Broadcast order event via WebSocket
   */
  async broadcastOrderEvent(tenantId: string, eventType: string, order: any): Promise<void> {
    await this.deliveryGateway.broadcastOrderEvent(tenantId, eventType, order);
    
    this.logger.log('[Uber Eats Order Service] Order event broadcasted', {
      tenantId,
      eventType,
      orderId: order.id,
    });
  }

  /**
   * Handle new order webhook
   */
  async handleNewOrder(tenantId: string, restaurantId: string, payload: UberEatsOrderPayload): Promise<void> {
    // Save order to database
    const order = await this.saveOrder(tenantId, restaurantId, payload);

    // Broadcast new order event
    await this.broadcastOrderEvent(tenantId, 'order:new', order);

    this.logger.log('[Uber Eats Order Service] New order handled', {
      orderId: order.id,
      platformOrderId: order.platformOrderId,
    });
  }

  /**
   * Handle order status update webhook
   */
  async handleOrderStatusUpdate(
    tenantId: string,
    platformOrderId: string,
    status: string,
    payload: any,
  ): Promise<void> {
    // Update order status
    await this.updateOrderStatus(tenantId, platformOrderId, status, payload);

    // Get updated order
    const order = await this.getOrderByPlatformId(tenantId, platformOrderId);

    if (order) {
      // Broadcast order update event
      await this.broadcastOrderEvent(tenantId, 'order:updated', order);

      this.logger.log('[Uber Eats Order Service] Order status update handled', {
        orderId: order.id,
        platformOrderId,
        status,
      });
    }
  }

  /**
   * Handle order cancellation webhook
   */
  async handleOrderCancellation(
    tenantId: string,
    platformOrderId: string,
    payload: any,
  ): Promise<void> {
    // Update order status
    await this.updateOrderStatus(tenantId, platformOrderId, 'cancelled', payload);

    // Get updated order
    const order = await this.getOrderByPlatformId(tenantId, platformOrderId);

    if (order) {
      // Broadcast order cancellation event
      await this.broadcastOrderEvent(tenantId, 'order:cancelled', order);

      this.logger.log('[Uber Eats Order Service] Order cancellation handled', {
        orderId: order.id,
        platformOrderId,
      });
    }
  }
}