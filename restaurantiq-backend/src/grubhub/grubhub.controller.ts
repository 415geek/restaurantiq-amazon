import { Controller, Get, Post, Body } from '@nestjs/common';
import { GrubHubService } from './grubhub.service';

@Controller('grubhub')
export class GrubHubController {
  constructor(private readonly grubHubService: GrubHubService) {}

  @Get('auth/status')
  async getAuthStatus() {
    return { status: 'not_implemented' };
  }

  @Post('auth/disconnect')
  async disconnect() {
    return { status: 'not_implemented' };
  }
}