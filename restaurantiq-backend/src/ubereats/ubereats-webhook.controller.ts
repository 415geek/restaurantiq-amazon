import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { UberEatsOrderService } from './ubereats-order.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Controller('webhooks/ubereats')
export class UberEatsWebhookController {
  private readonly logger = new Logger(UberEatsWebhookController.name);

  constructor(
    private readonly uberEatsOrderService: UberEatsOrderService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handle Uber Eats webhook
   */
  @Post()
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-uber-signature') signature: string,
    @Headers('x-uber-event-type') eventType: string,
    @Headers('x-uber-store-id') storeId: string,
  ) {
    this.logger.log(`[Uber Eats Webhook] Received event: ${eventType}, store: ${storeId}`);

    // Verify HMAC signature
    const isValid = this.verifySignature(payload, signature);
    if (!isValid) {
      this.logger.error('[Uber Eats Webhook] Invalid signature');
      return {
        received: false,
        error: 'Invalid signature',
      };
    }

    this.logger.log('[Uber Eats Webhook] Signature verified');

    // Parse order from payload
    const order = this.uberEatsOrderService.parseWebhookOrder(payload, storeId);
    if (!order) {
      this.logger.warn('[Uber Eats Webhook] Could not parse order from payload');
      return {
        received: true,
        warning: 'Could not parse order',
      };
    }

    this.logger.log(`[Uber Eats Webhook] Parsed order: ${order.id}, status: ${order.status}`);

    // TODO: Get tenantId from storeId mapping
    // For now, use a default tenant
    const tenantId = 'default-tenant';

    // Save order to database
    try {
      await this.uberEatsOrderService.saveOrder(tenantId, order);
      this.logger.log(`[Uber Eats Webhook] Order saved successfully: ${order.id}`);
    } catch (error) {
      this.logger.error(`[Uber Eats Webhook] Failed to save order: ${error}`);
      return {
        received: false,
        error: 'Failed to save order',
      };
    }

    return {
      received: true,
      orderId: order.id,
      status: order.status,
    };
  }

  /**
   * Verify HMAC signature
   */
  private verifySignature(payload: any, signature: string): boolean {
    if (!signature) {
      this.logger.warn('[Uber Eats Webhook] No signature provided');
      return false;
    }

    const webhookSecret = this.configService.get<string>('UBEREATS_WEBHOOK_SIGNING_KEY');
    if (!webhookSecret) {
      this.logger.warn('[Uber Eats Webhook] No webhook secret configured');
      return false;
    }

    try {
      // Convert payload to string
      const payloadString = JSON.stringify(payload);

      // Compute HMAC
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(payloadString);
      const computedSignature = hmac.digest('hex');

      // Compare signatures (timing-safe comparison)
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature),
      );

      if (!isValid) {
        this.logger.error(`[Uber Eats Webhook] Signature mismatch`);
        this.logger.error(`[Uber Eats Webhook] Expected: ${computedSignature}`);
        this.logger.error(`[Uber Eats Webhook] Received: ${signature}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error(`[Uber Eats Webhook] Signature verification error: ${error}`);
      return false;
    }
  }
}