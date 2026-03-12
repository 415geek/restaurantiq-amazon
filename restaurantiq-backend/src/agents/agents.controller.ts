import { Controller, Post, Body } from '@nestjs/common';
import { AgentsProxyService } from './agents-proxy.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsProxyService: AgentsProxyService) {}

  @Post('run')
  async runAgent(@Body() body: any) {
    // TODO: Implement agent execution proxy to Python service
    return { status: 'not_implemented' };
  }
}