import { Controller, Get, Post, Param, Body, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

type DeliveryOrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

@Controller('orders')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  /**
   * Get orders with filters
   */
  @Get()
  async getOrders(
    @Query('tenantId') tenantId: string,
    @Query('platform') platform?: string,
    @Query('status') status?: DeliveryOrderStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    const result = await this.deliveryService.getOrders({
      tenantId,
      platform,
      status,
      from,
      to,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return result;
  }

  /**
   * Get order by ID
   */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    try {
      const order = await this.deliveryService.getOrderById(id);
      return order;
    } catch (error) {
      throw new NotFoundException('Order not found');
    }
  }

  /**
   * Accept order
   */
  @Post(':id/accept')
  async acceptOrder(
    @Param('id') id: string,
    @Body() body: { tenantId: string },
  ) {
    if (!body.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    try {
      const order = await this.deliveryService.acceptOrder(id, body.tenantId);
      return { success: true, order };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to accept order');
    }
  }

  /**
   * Start preparation
   */
  @Post(':id/start-prep')
  async startPrep(
    @Param('id') id: string,
    @Body() body: { tenantId: string },
  ) {
    if (!body.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    try {
      const order = await this.deliveryService.startPrep(id, body.tenantId);
      return { success: true, order };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to start preparation');
    }
  }

  /**
   * Mark order as ready
   */
  @Post(':id/ready')
  async markReady(
    @Param('id') id: string,
    @Body() body: { tenantId: string },
  ) {
    if (!body.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    try {
      const order = await this.deliveryService.markReady(id, body.tenantId);
      return { success: true, order };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to mark order as ready');
    }
  }

  /**
   * Complete order
   */
  @Post(':id/complete')
  async completeOrder(
    @Param('id') id: string,
    @Body() body: { tenantId: string },
  ) {
    if (!body.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    try {
      const order = await this.deliveryService.completeOrder(id, body.tenantId);
      return { success: true, order };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to complete order');
    }
  }

  /**
   * Cancel order
   */
  @Post(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body() body: { tenantId: string; reason: string },
  ) {
    if (!body.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    if (!body.reason) {
      throw new BadRequestException('reason is required');
    }

    try {
      const order = await this.deliveryService.cancelOrder(id, body.tenantId, body.reason);
      return { success: true, order };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to cancel order');
    }
  }
}