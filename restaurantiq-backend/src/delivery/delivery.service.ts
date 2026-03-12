import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UberEatsOrderService } from '../ubereats/ubereats-order.service';
import { DeliveryGateway } from './delivery.gateway';

@Injectable()
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private uberEatsOrderService: UberEatsOrderService,
    private deliveryGateway: DeliveryGateway,
  ) {}

  /**
   * Get orders with filters
   */
  async getOrders(filters: {
    tenantId: string;
    platform?: string;
    status?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const { tenantId, platform, status, from, to, limit = 50, offset = 0 } = filters;

    const where: any = {
      tenantId,
    };

    if (platform) {
      where.platform = platform;
    }

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.placedAt = {};
      if (from) {
        where.placedAt.gte = from;
      }
      if (to) {
        where.placedAt.lte = to;
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Get order by ID
   */
  async getOrderById(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  /**
   * Get order by platform order ID
   */
  async getOrderByPlatformId(tenantId: string, platform: string, platformOrderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        tenantId,
        platform,
        platformOrderId,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${platformOrderId} not found`);
    }

    return order;
  }

  /**
   * Accept order
   */
  async acceptOrder(id: string, tenantId: string) {
    const order = await this.getOrderById(id, tenantId);

    if (order.status !== 'NEW') {
      throw new BadRequestException(`Order is not in NEW status (current: ${order.status})`);
    }

    // Update local status
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Call platform API if needed
    if (order.platform === 'UBEREATS') {
      try {
        await this.uberEatsOrderService.acceptOrder(tenantId, order.platformOrderId);
      } catch (error) {
        // Rollback local status if platform call fails
        await this.prisma.order.update({
          where: { id },
          data: {
            status: 'NEW',
            acceptedAt: null,
            updatedAt: new Date(),
          },
        });
        throw error;
      }
    }

    // Broadcast update
    await this.deliveryGateway.broadcastOrderEvent(tenantId, 'order:updated', updatedOrder);

    return updatedOrder;
  }

  /**
   * Start preparation
   */
  async startPrep(id: string, tenantId: string) {
    const order = await this.getOrderById(id, tenantId);

    if (order.status !== 'ACCEPTED') {
      throw new BadRequestException(`Order is not in ACCEPTED status (current: ${order.status})`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'PREPARING',
        updatedAt: new Date(),
      },
    });

    // Call platform API if needed
    if (order.platform === 'UBEREATS') {
      try {
        await this.uberEatsOrderService.updateOrderStatusOnPlatform(
          tenantId,
          order.platformOrderId,
          'preparing',
        );
      } catch (error) {
        // Rollback local status if platform call fails
        await this.prisma.order.update({
          where: { id },
          data: {
            status: 'ACCEPTED',
            updatedAt: new Date(),
          },
        });
        throw error;
      }
    }

    // Broadcast update
    await this.deliveryGateway.broadcastOrderEvent(tenantId, 'order:updated', updatedOrder);

    return updatedOrder;
  }

  /**
   * Mark order as ready
   */
  async markReady(id: string, tenantId: string) {
    const order = await this.getOrderById(id, tenantId);

    if (order.status !== 'PREPARING') {
      throw new BadRequestException(`Order is not in PREPARING status (current: ${order.status})`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'READY',
        readyAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Call platform API if needed
    if (order.platform === 'UBEREATS') {
      try {
        await this.uberEatsOrderService.updateOrderStatusOnPlatform(
          tenantId,
          order.platformOrderId,
          'ready_for_pickup',
        );
      } catch (error) {
        // Rollback local status if platform call fails
        await this.prisma.order.update({
          where: { id },
          data: {
            status: 'PREPARING',
            readyAt: null,
            updatedAt: new Date(),
          },
        });
        throw error;
      }
    }

    // Broadcast update
    await this.deliveryGateway.broadcastOrderEvent(tenantId, 'order:updated', updatedOrder);

    return updatedOrder;
  }

  /**
   * Complete order
   */
  async completeOrder(id: string, tenantId: string) {
    const order = await this.getOrderById(id, tenantId);

    if (order.status !== 'READY') {
      throw new BadRequestException(`Order is not in READY status (current: ${order.status})`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Broadcast update
    await this.deliveryGateway.broadcastOrderEvent(tenantId, 'order:updated', updatedOrder);

    return updatedOrder;
  }

  /**
   * Cancel order
   */
  async cancelOrder(id: string, tenantId: string, reason: string) {
    const order = await this.getOrderById(id, tenantId);

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel order in ${order.status} status`);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Call platform API if needed
    if (order.platform === 'UBEREATS') {
      try {
        await this.uberEatsOrderService.cancelOrder(tenantId, order.platformOrderId, reason);
      } catch (error) {
        // Rollback local status if platform call fails
        await this.prisma.order.update({
          where: { id },
          data: {
            status: order.status,
            cancelReason: null,
            cancelledAt: null,
            updatedAt: new Date(),
          },
        });
        throw error;
      }
    }

    // Broadcast update
    await this.deliveryGateway.broadcastOrderEvent(tenantId, 'order:cancelled', updatedOrder);

    return updatedOrder;
  }

  /**
   * Get order statistics
   */
  async getOrderStats(tenantId: string, from?: Date, to?: Date) {
    const where: any = {
      tenantId,
    };

    if (from || to) {
      where.placedAt = {};
      if (from) {
        where.placedAt.gte = from;
      }
      if (to) {
        where.placedAt.lte = to;
      }
    }

    const [
      totalOrders,
      newOrders,
      preparingOrders,
      readyOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: { ...where, status: 'NEW' } }),
      this.prisma.order.count({ where: { ...where, status: 'PREPARING' } }),
      this.prisma.order.count({ where: { ...where, status: 'READY' } }),
      this.prisma.order.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.order.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.order.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { total: true },
      }),
    ]);

    return {
      totalOrders,
      newOrders,
      preparingOrders,
      readyOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue: totalRevenue._sum.total || 0,
    };
  }

  /**
   * Get orders by status for Kanban board
   */
  async getKanbanOrders(tenantId: string) {
    const [newOrders, preparingOrders, readyOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: { tenantId, status: 'NEW' },
        orderBy: { placedAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: { tenantId, status: 'PREPARING' },
        orderBy: { placedAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: { tenantId, status: 'READY' },
        orderBy: { placedAt: 'asc' },
      }),
    ]);

    return {
      new: newOrders,
      preparing: preparingOrders,
      ready: readyOrders,
    };
  }
}