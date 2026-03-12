import { Controller, Get, Post, Body } from '@nestjs/common';
import { DoorDashService } from './doordash.service';

@Controller('doordash')
export class DoorDashController {
  constructor(private readonly doorDashService: DoorDashService) {}

  @Get('auth/status')
  async getAuthStatus() {
    return { status: 'not_implemented' };
  }

  @Post('auth/disconnect')
  async disconnect() {
    return { status: 'not_implemented' };
  }
}