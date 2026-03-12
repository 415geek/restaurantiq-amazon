import { Controller, Get, Post, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

@Controller('orders')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get()
  async getOrders(
    @Query('tenantId') tenantId: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    return this.deliveryService.getOrders({
      tenantId,
      platform,
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('kanban')
  async getKanbanOrders(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.deliveryService.getKanbanOrders(tenantId);
  }

  @Get('stats')
  async getOrderStats(
    @Query('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.deliveryService.getOrderStats(
      tenantId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get(':id')
  async getOrder(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.deliveryService.getOrderById(id, tenantId);
  }

  @Post(':id/accept')
  async acceptOrder(@Param('id') id: string, @Body() body: { tenantId: string }) {
    return this.deliveryService.acceptOrder(id, body.tenantId);
  }

  @Post(':id/start-prep')
  async startPrep(@Param('id') id: string, @Body() body: { tenantId: string }) {
    return this.deliveryService.startPrep(id, body.tenantId);
  }

  @Post(':id/ready')
  async markReady(@Param('id') id: string, @Body() body: { tenantId: string }) {
    return this.deliveryService.markReady(id, body.tenantId);
  }

  @Post(':id/complete')
  async completeOrder(@Param('id') id: string, @Body() body: { tenantId: string }) {
    return this.deliveryService.completeOrder(id, body.tenantId);
  }

  @Post(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body() body: { tenantId: string; reason: string },
  ) {
    return this.deliveryService.cancelOrder(id, body.tenantId, body.reason);
  }
}