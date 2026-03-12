import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { UberEatsTokenService } from './ubereats-token.service';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class UberEatsService {
  private apiClient: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private environment: string;
  private apiBaseUrl: string;
  private webhookSigningKey: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private tokenService: UberEatsTokenService,
  ) {
    this.clientId = this.configService.get<string>('UBEREATS_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('UBEREATS_CLIENT_SECRET')!;
    this.environment = this.configService.get<string>('UBEREATS_ENVIRONMENT') || 'sandbox';
    this.apiBaseUrl = this.configService.get<string>('UBEREATS_API_BASE_URL') || 
      (this.environment === 'production' ? 'https://api.uber.com' : 'https://sandbox-api.uber.com');
    this.webhookSigningKey = this.configService.get<string>('UBEREATS_WEBHOOK_SIGNING_KEY')!;

    this.apiClient = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
    });

    console.log('[Uber Eats Service] Initialized', {
      environment: this.environment,
      apiBaseUrl: this.apiBaseUrl,
      clientId: this.clientId.substring(0, 8) + '...',
    });
  }

  /**
   * Generate OAuth authorization URL
   */
  async getOAuthUrl(tenantId: string, redirectUri: string): Promise<{ url: string; state: string }> {
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in Redis for verification
    await this.tokenService.cacheState(state, tenantId);

    const scopes = this.configService.get<string>('UBEREATS_AUTHORIZATION_CODE_SCOPES') || 
      'eats.pos_provisioning';
    
    const authUrl = new URL(this.configService.get<string>('UBEREATS_OAUTH_AUTHORIZE_URL')!);
    authUrl.searchParams.append('client_id', this.clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);

    console.log('[Uber Eats OAuth] Generated authorization URL', {
      tenantId,
      state: state.substring(0, 8) + '...',
    });

    return { url: authUrl.toString(), state };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // Verify state
    const tenantId = await this.tokenService.verifyState(state);
    if (!tenantId) {
      throw new BadRequestException('Invalid or expired state parameter');
    }

    try {
      const tokenUrl = this.configService.get<string>('UBEREATS_OAUTH_TOKEN_URL')!;
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const tokens = response.data;
      
      console.log('[Uber Eats OAuth] Token exchange successful', {
        tenantId,
        accessToken: tokens.access_token.substring(0, 20) + '...',
        expiresIn: tokens.expires_in,
      });

      // Store tokens in database (encrypted)
      await this.prisma.integration.upsert({
        where: {
          tenantId_platform: {
            tenantId,
            platform: 'UBEREATS',
          },
        },
        create: {
          tenantId,
          platform: 'UBEREATS',
          status: 'CONNECTED',
          accessTokenEnc: tokens.access_token,
          refreshTokenEnc: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
        update: {
          status: 'CONNECTED',
          accessTokenEnc: tokens.access_token,
          refreshTokenEnc: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          updatedAt: new Date(),
        },
      });

      // Cache token in Redis
      await this.tokenService.cacheToken(tenantId, tokens.access_token, tokens.expires_in);

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      };
    } catch (error: any) {
      console.error('[Uber Eats OAuth] Token exchange failed', {
        error: error.message,
        response: error.response?.data,
      });
      throw new BadRequestException('Failed to exchange authorization code for token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(tenantId: string): Promise<string> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_platform: {
          tenantId,
          platform: 'UBEREATS',
        },
      },
    });

    if (!integration || !integration.refreshTokenEnc) {
      throw new UnauthorizedException('No refresh token found');
    }

    try {
      const tokenUrl = this.configService.get<string>('UBEREATS_OAUTH_TOKEN_URL')!;
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: integration.refreshTokenEnc,
        grant_type: 'refresh_token',
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const tokens = response.data;
      
      console.log('[Uber Eats OAuth] Token refresh successful', {
        tenantId,
        accessToken: tokens.access_token.substring(0, 20) + '...',
        expiresIn: tokens.expires_in,
      });

      // Update tokens in database
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessTokenEnc: tokens.access_token,
          refreshTokenEnc: tokens.refresh_token || integration.refreshTokenEnc,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          updatedAt: new Date(),
        },
      });

      // Cache token in Redis
      await this.tokenService.cacheToken(tenantId, tokens.access_token, tokens.expires_in);

      return tokens.access_token;
    } catch (error: any) {
      console.error('[Uber Eats OAuth] Token refresh failed', {
        error: error.message,
        response: error.response?.data,
      });
      
      // Mark integration as error
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: { status: 'ERROR' },
      });

      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  /**
   * Get access token (with auto-refresh)
   */
  async getAccessToken(tenantId: string): Promise<string> {
    // Check cache first
    const cachedToken = await this.tokenService.getCachedToken(tenantId);
    if (cachedToken) {
      return cachedToken;
    }

    // Check database
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_platform: {
          tenantId,
          platform: 'UBEREATS',
        },
      },
    });

    if (!integration) {
      throw new UnauthorizedException('Uber Eats not connected');
    }

    // Check if token is expired
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      console.log('[Uber Eats OAuth] Token expired, refreshing...', { tenantId });
      return this.refreshAccessToken(tenantId);
    }

    // Cache and return
    const expiresIn = integration.tokenExpiresAt 
      ? Math.floor((integration.tokenExpiresAt.getTime() - Date.now()) / 1000)
      : 3600;
    
    await this.tokenService.cacheToken(tenantId, integration.accessTokenEnc!, expiresIn);
    return integration.accessTokenEnc!;
  }

  /**
   * Disconnect Uber Eats integration
   */
  async disconnect(tenantId: string): Promise<void> {
    await this.prisma.integration.deleteMany({
      where: {
        tenantId,
        platform: 'UBEREATS',
      },
    });

    // Clear cache
    await this.tokenService.clearCachedToken(tenantId);

    console.log('[Uber Eats OAuth] Disconnected', { tenantId });
  }

  /**
   * Get OAuth status
   */
  async getAuthStatus(tenantId: string): Promise<{
    connected: boolean;
    status: string;
    storeId?: string;
    lastSyncAt?: Date;
  }> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_platform: {
          tenantId,
          platform: 'UBEREATS',
        },
      },
    });

    if (!integration) {
      return { connected: false, status: 'DISCONNECTED' };
    }

    return {
      connected: integration.status === 'CONNECTED',
      status: integration.status,
      storeId: integration.platformStoreId || undefined,
      lastSyncAt: integration.lastSyncAt || undefined,
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.webhookSigningKey);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );

    if (!isValid) {
      console.error('[Uber Eats Webhook] Signature verification failed', {
        received: signature,
        expected: expectedSignature,
      });
    }

    return isValid;
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest(
    tenantId: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
  ): Promise<any> {
    const accessToken = await this.getAccessToken(tenantId);

    try {
      const response = await this.apiClient.request({
        method,
        url: endpoint,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        data,
      });

      return response.data;
    } catch (error: any) {
      console.error('[Uber Eats API] Request failed', {
        method,
        endpoint,
        error: error.message,
        response: error.response?.data,
      });

      if (error.response?.status === 401) {
        // Token might be expired, try refresh
        await this.refreshAccessToken(tenantId);
        const newAccessToken = await this.getAccessToken(tenantId);
        
        // Retry with new token
        const retryResponse = await this.apiClient.request({
          method,
          url: endpoint,
          headers: {
            'Authorization': `Bearer ${newAccessToken}`,
            'Content-Type': 'application/json',
          },
          data,
        });

        return retryResponse.data;
      }

      throw error;
    }
  }
}