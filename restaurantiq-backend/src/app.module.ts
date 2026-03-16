import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UberEatsModule } from './ubereats/ubereats.module';
import { DoorDashModule } from './doordash/doordash.module';
import { GrubHubModule } from './grubhub/grubhub.module';
import { DeliveryModule } from './delivery/delivery.module';
import { LlmModule } from './llm/llm.module';
import { AgentsModule } from './agents/agents.module';
import { AnalysisModule } from './analysis/analysis.module';
import { ExecutionModule } from './execution/execution.module';
import { SocialModule } from './social/social.module';
import { NovaActModule } from './nova-act/nova-act.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Core Infrastructure
    PrismaModule,
    RedisModule,

    // Business Modules
    UberEatsModule,
    DoorDashModule,
    GrubHubModule,
    DeliveryModule,
    LlmModule,
    AgentsModule,
    AnalysisModule,
    ExecutionModule,
    SocialModule,
    NovaActModule,
  ],
})
export class AppModule {}