import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsProxyService } from './agents-proxy.service';

@Module({
  controllers: [AgentsController],
  providers: [AgentsProxyService],
  exports: [AgentsProxyService],
})
export class AgentsModule {}