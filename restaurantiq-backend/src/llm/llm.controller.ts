import { Controller, Post, Body } from '@nestjs/common';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('chat')
  async chat(@Body() body: any) {
    // TODO: Implement chat endpoint
    return { response: 'not_implemented' };
  }
}