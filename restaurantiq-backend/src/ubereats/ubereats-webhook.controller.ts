import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { UberEatsService } from './ubereats.service';
import { UberEatsOrderService } from './ubereats-order.service';
import { PrismaService } from '../database/prisma.service';

@Controller('webhooks/ubereats')
export class UberEatsWebhookController {
  private readonly logger = new Logger(UberEatsWebhookController.name);

  constructor(
    private uberEatsService: UberEatsService,
    private orderService: UberEatsOrderService,
    private prisma: PrismaService,
  ) {
    this.logger.log('[Uber Eats Webhook Controller] Initialized');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-uber-signature') signature: string,
    @Headers('x-uber-event-type') eventType: string,
  ) {
    this.logger.log('[Uber Eats Webhook] Received webhook', {
      eventType,
      signature: signature?.substring(0, 20) + '...',
    });

    try {
      // Verify signature
      const payloadString = JSON.stringify(payload);
      const isValid = this.uberEatsService.verifyWebhookSignature(payloadString, signature);

      if (!isValid) {
        this.logger.error('[Uber Eats Webhook] Invalid signature');
        return { success: false, error: 'Invalid signature' };
      }

      // Log webhook event
      await this.prisma.webhookEvent.create({
        data: {
          platform: 'UBEREATS',
          topic: eventType,
          eventType: eventType,
          storeId: payload.store_id,
          payload: payload,
          processed: false,
          receivedAt: new Date(),
        },
      });

      // Determine tenant ID from store ID
      const integration = await this.prisma.integration.findFirst({
        where: {
          platform: 'UBEREATS',
          platformStoreId: payload.store_id,
        },
      });

      if (!integration) {
        this.logger.warn('[Uber Eats Webhook] No integration found for store', {
          storeId: payload.store_id,
        });
        return { success: false, error: 'Store not found' };
      }

      const tenantId = integration.tenantId;
      const restaurantId = integration.restaurantId || '';

      // Handle different event types
      switch (eventType) {
        case 'orders.created':
        case 'orders.new':
          await this.orderService.handleNewOrder(tenantId, restaurantId, payload);
          break;

        case 'orders.status.updated':
          await this.orderService.handleOrderStatusUpdate(
            tenantId,
            payload.order_id,
            payload.status,
            payload,
          );
          break;

        case 'orders.cancelled':
        case 'orders.canceled':
          await this.orderService.handleOrderCancellation(
            tenantId,
            payload.order_id,
            payload,
          );
          break;

        case 'stores.status.updated':
          // Handle store status update
          this.logger.log('[Uber Eats Webhook] Store status updated', {
            storeId: payload.store_id,
            status: payload.status,
          });
          break;

        default:
          this.logger.warn('[Uber Eats Webhook] Unknown event type', { eventType });
      }

      // Mark webhook event as processed
      await this.prisma.webhookEvent.updateMany({
        where: {
          platform: 'UBEREATS',
          storeId: payload.store_id,
          receivedAt: new Date(),
        },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      this.logger.log('[Uber Eats Webhook] Processed successfully', { eventType });

      return { success: true };
    } catch (error: any) {
      this.logger.error('[Uber Eats Webhook] Processing failed', {
        error: error.message,
        stack: error.stack,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Webhook verification endpoint (for Uber Eats to verify webhook URL)
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyWebhook(@Body() body: any) {
    this.logger.log('[Uber Eats Webhook] Verification request', {
      verification_code: body.verification_code,
    });

    // Return the verification code to confirm webhook URL
    return {
      verification_code: body.verification_code,
    };
  }
}