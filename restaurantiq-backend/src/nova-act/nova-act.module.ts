import { Module } from '@nestjs/common';
import { NovaActController } from './nova-act.controller';
import { NovaActService } from './nova-act.service';

@Module({
  controllers: [NovaActController],
  providers: [NovaActService],
})
export class NovaActModule {}

