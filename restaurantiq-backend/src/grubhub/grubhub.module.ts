import { Module } from '@nestjs/common';
import { GrubHubController } from './grubhub.controller';
import { GrubHubService } from './grubhub.service';

@Module({
  controllers: [GrubHubController],
  providers: [GrubHubService],
  exports: [GrubHubService],
})
export class GrubHubModule {}