import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { UberEatsService } from './ubereats.service';
import { UberEatsTokenService } from './ubereats-token.service';

@Controller('ubereats')
export class UberEatsController {
  constructor(
    private readonly uberEatsService: UberEatsService,
    private readonly uberEatsTokenService: UberEatsTokenService,
  ) {}

  /**
   * Get OAuth configuration status
   */
  @Get('auth/status')
  async getAuthStatus() {
    const status = this.uberEatsService.getConfigStatus();
    return status;
  }

  /**
   * Generate OAuth authorization URL
   */
  @Get('auth/start')
  async startAuth(
    @Query('tenantId') tenantId: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const authUrl = this.uberEatsService.generateAuthUrl(tenantId, storeId);
    return { authUrl };
  }

  /**
   * Handle OAuth callback
   */
  @Get('auth/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      return {
        success: false,
        error: `OAuth error: ${error}`,
      };
    }

    if (!code || !state) {
      return {
        success: false,
        error: 'Missing code or state parameter',
      };
    }

    const result = await this.uberEatsService.handleCallback(code, state);
    return result;
  }

  /**
   * Get connection status
   */
  @Get('connection/status')
  async getConnectionStatus(
    @Query('tenantId') tenantId: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const status = await this.uberEatsService.getConnectionStatus(tenantId, storeId);
    return status;
  }

  /**
   * Disconnect Uber Eats integration
   */
  @Post('auth/disconnect')
  async disconnect(
    @Body() body: { tenantId: string; storeId?: string },
  ) {
    if (!body.tenantId) {
      return { error: 'tenantId is required' };
    }

    await this.uberEatsService.disconnect(body.tenantId, body.storeId);
    return { success: true };
  }

  /**
   * Get access token (for testing)
   */
  @Get('token')
  async getToken(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const result = await this.uberEatsTokenService.resolveAccessToken(tenantId);
    return {
      token: result.token ? `${result.token.substring(0, 20)}...` : null,
      source: result.source,
      warning: result.warning,
    };
  }
}