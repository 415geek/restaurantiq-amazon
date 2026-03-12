import { Module } from '@nestjs/common';
import { UberEatsController } from './ubereats.controller';
import { UberEatsService } from './ubereats.service';
import { UberEatsTokenService } from './ubereats-token.service';
import { UberEatsOrderService } from './ubereats-order.service';
import { UberEatsWebhookController } from './ubereats-webhook.controller';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [DeliveryModule],
  controllers: [UberEatsController, UberEatsWebhookController],
  providers: [UberEatsService, UberEatsTokenService, UberEatsOrderService],
  exports: [UberEatsService, UberEatsTokenService, UberEatsOrderService],
})
export class UberEatsModule {}