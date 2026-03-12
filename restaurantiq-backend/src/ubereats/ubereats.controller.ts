import { Controller, Get, Post, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { UberEatsService } from './ubereats.service';
import { UberEatsOrderService } from './ubereats-order.service';

@Controller('ubereats')
export class UberEatsController {
  constructor(
    private readonly uberEatsService: UberEatsService,
    private readonly orderService: UberEatsOrderService,
  ) {}

  @Get('auth/status')
  async getAuthStatus(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.uberEatsService.getAuthStatus(tenantId);
  }

  @Post('auth/url')
  async getOAuthUrl(@Body() body: { tenantId: string; redirectUri: string }) {
    return this.uberEatsService.getOAuthUrl(body.tenantId, body.redirectUri);
  }

  @Post('auth/callback')
  async handleCallback(@Body() body: { code: string; state: string; redirectUri: string }) {
    return this.uberEatsService.exchangeCodeForToken(body.code, body.state, body.redirectUri);
  }

  @Post('auth/disconnect')
  async disconnect(@Body() body: { tenantId: string }) {
    return this.uberEatsService.disconnect(body.tenantId);
  }

  @Get('orders')
  async getOrders(@Query('tenantId') tenantId: string, @Query('limit') limit?: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.orderService.getRecentOrders(tenantId, limit ? parseInt(limit) : 50);
  }

  @Get('orders/status/:status')
  async getOrdersByStatus(
    @Param('status') status: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.orderService.getOrdersByStatus(tenantId, status);
  }

  @Post('orders/:platformOrderId/accept')
  async acceptOrder(
    @Param('platformOrderId') platformOrderId: string,
    @Body() body: { tenantId: string },
  ) {
    return this.orderService.acceptOrder(body.tenantId, platformOrderId);
  }

  @Post('orders/:platformOrderId/cancel')
  async cancelOrder(
    @Param('platformOrderId') platformOrderId: string,
    @Body() body: { tenantId: string; reason: string },
  ) {
    return this.orderService.cancelOrder(body.tenantId, platformOrderId, body.reason);
  }

  @Post('orders/:platformOrderId/status')
  async updateOrderStatus(
    @Param('platformOrderId') platformOrderId: string,
    @Body() body: { tenantId: string; status: 'preparing' | 'ready_for_pickup' | 'driver_at_pickup' },
  ) {
    return this.orderService.updateOrderStatusOnPlatform(body.tenantId, platformOrderId, body.status);
  }
}