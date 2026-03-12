import { Module } from '@nestjs/common';
import { DoorDashController } from './doordash.controller';
import { DoorDashService } from './doordash.service';

@Module({
  controllers: [DoorDashController],
  providers: [DoorDashService],
  exports: [DoorDashService],
})
export class DoorDashModule {}