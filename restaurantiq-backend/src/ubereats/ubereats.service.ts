import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

type OAuthResult = {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
};

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

// Default Uber Eats scopes for delivery management
const DEFAULT_SCOPES = [
  'eats.store.read',
  'eats.store.orders.read',
  'eats.store.status.write',
  'eats.store.orders.write',
  'eats.pos_provisioning',
  'eats.store.settings',
];

@Injectable()
export class UberEatsService {
  private config: OAuthConfig;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    this.config = {
      clientId: this.configService.get<string>('UBEREATS_CLIENT_ID') || '',
      clientSecret: this.configService.get<string>('UBEREATS_CLIENT_SECRET') || '',
      redirectUri: `${this.configService.get<string>('NEXT_PUBLIC_APP_URL')}/api/v1/ubereats/auth/callback`,
      authUrl: this.configService.get<string>('UBEREATS_OAUTH_AUTHORIZE_URL') || 'https://sandbox-login.uber.com/oauth/v2/authorize',
      tokenUrl: this.configService.get<string>('UBEREATS_OAUTH_TOKEN_URL') || 'https://sandbox-login.uber.com/oauth/v2/token',
      scopes: DEFAULT_SCOPES,
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(tenantId: string, storeId?: string): string {
    const state = this.generateState(tenantId, storeId);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      state: state,
      scope: this.config.scopes.join(' '),
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * Generate secure state parameter for CSRF protection
   */
  private generateState(tenantId: string, storeId?: string): string {
    const stateData = {
      tenantId,
      storeId,
      timestamp: Date.now(),
      nonce: this.generateNonce(),
    };
    return Buffer.from(JSON.stringify(stateData)).toString('base64');
  }

  /**
   * Generate random nonce for security
   */
  private generateNonce(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string, state: string): Promise<OAuthResult> {
    try {
      // Parse and validate state
      const stateData = this.parseState(state);
      if (!stateData) {
        return {
          success: false,
          error: 'Invalid state parameter',
        };
      }

      // Exchange authorization code for tokens
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
      });

      const tokenResponse = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: params.toString(),
        cache: 'no-store',
      });

      const tokenData = await this.parseTokenResponse(tokenResponse);
      if (!tokenData) {
        throw new Error('Failed to parse token response');
      }

      // Store tokens in database (encrypted)
      await this.storeTokens(stateData.tenantId, stateData.storeId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      });

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      };
    } catch (error) {
      console.error('[Uber Eats OAuth] Error exchanging authorization code:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse state parameter
   */
  private parseState(state: string): { tenantId: string; storeId?: string } | null {
    try {
      const data = JSON.parse(Buffer.from(state, 'base64').toString());
      
      // Validate timestamp (state expires after 10 minutes)
      if (Date.now() - data.timestamp > 10 * 60 * 1000) {
        return null;
      }

      return {
        tenantId: data.tenantId,
        storeId: data.storeId,
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse Uber OAuth token response
   */
  private async parseTokenResponse(response: Response): Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null> {
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    } catch (error) {
      console.error('[Uber Eats OAuth] Error parsing token response:', error);
      
      // Try text/x-www-form-urlencoded format
      try {
        const params = new URLSearchParams(text);
        return {
          access_token: params.get('access_token') || undefined,
          refresh_token: params.get('refresh_token') || undefined,
          expires_in: params.get('expires_in') ? parseInt(params.get('expires_in') || '') : undefined,
        };
      } catch {
        return null;
      }
    }
  }

  /**
   * Store OAuth tokens in database (encrypted)
   */
  private async storeTokens(
    tenantId: string,
    storeId: string | undefined,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    },
  ): Promise<void> {
    // TODO: Implement AES-256 encryption
    const accessTokenEnc = tokens.accessToken; // Will be encrypted
    const refreshTokenEnc = tokens.refreshToken; // Will be encrypted
    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    // Find or create integration
    const integration = await this.prisma.integration.upsert({
      where: {
        tenantId_platform_platformStoreId: {
          tenantId,
          platform: 'UBEREATS',
          platformStoreId: storeId || 'default',
        },
      },
      update: {
        status: 'CONNECTED',
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
        lastSyncAt: new Date(),
      },
      create: {
        tenantId,
        platform: 'UBEREATS',
        platformStoreId: storeId || 'default',
        status: 'CONNECTED',
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
        lastSyncAt: new Date(),
      },
    });

    console.log(`[Uber Eats OAuth] Tokens stored for integration ${integration.id}`);
  }

  /**
   * Get OAuth configuration status
   */
  getConfigStatus(): { configured: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.config.clientId) {
      issues.push('UBEREATS_CLIENT_ID not configured');
    }
    if (!this.config.clientSecret) {
      issues.push('UBEREATS_CLIENT_SECRET not configured');
    }
    if (!this.config.redirectUri) {
      issues.push('NEXT_PUBLIC_APP_URL not configured for redirect URI');
    }
    if (!this.config.authUrl) {
      issues.push('UBEREATS_OAUTH_AUTHORIZE_URL not configured');
    }
    if (!this.config.tokenUrl) {
      issues.push('UBEREATS_OAUTH_TOKEN_URL not configured');
    }

    return {
      configured: issues.length === 0,
      issues,
    };
  }

  /**
   * Disconnect Uber Eats integration
   */
  async disconnect(tenantId: string, storeId?: string): Promise<void> {
    await this.prisma.integration.updateMany({
      where: {
        tenantId,
        platform: 'UBEREATS',
        platformStoreId: storeId || 'default',
      },
      data: {
        status: 'DISCONNECTED',
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
      },
    });

    // Clear Redis cache
    await this.redis.del(`token:ubereats:${tenantId}`);
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(tenantId: string, storeId?: string) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_platform_platformStoreId: {
          tenantId,
          platform: 'UBEREATS',
          platformStoreId: storeId || 'default',
        },
      },
    });

    if (!integration) {
      return {
        connected: false,
        status: 'DISCONNECTED',
      };
    }

    return {
      connected: integration.status === 'CONNECTED',
      status: integration.status,
      platformStoreId: integration.platformStoreId,
      platformStoreName: integration.platformStoreName,
      lastSyncAt: integration.lastSyncAt,
    };
  }
}