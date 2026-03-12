import { Module } from '@nestjs/common';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { AnthropicService } from './anthropic.service';
import { OpenaiService } from './openai.service';
import { LlmRouterService } from './llm-router.service';

@Module({
  controllers: [LlmController],
  providers: [LlmService, AnthropicService, OpenaiService, LlmRouterService],
  exports: [LlmService, AnthropicService, OpenaiService, LlmRouterService],
})
export class LlmModule {}