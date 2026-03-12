import { Injectable } from '@nestjs/common';
import { LlmRouterService } from './llm-router.service';

@Injectable()
export class LlmService {
  constructor(private llmRouter: LlmRouterService) {}

  // TODO: Implement high-level LLM operations
  async generateDailyBriefing(data: any) {
    return this.llmRouter.balancedChat({
      system: 'You are a restaurant operations analyst.',
      messages: [{ role: 'user', content: 'Generate daily briefing' }],
    });
  }
}