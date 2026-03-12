import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

export type UberResolvedTokenSource =
  | 'oauth_connection'
  | 'env_bearer_token'
  | 'client_credentials'
  | 'none';

export type UberResolvedToken = {
  token: string;
  source: UberResolvedTokenSource;
  warning?: string;
  setupGuide?: string;
  errorDetails?: string;
};

// Global token cache to prevent rate limiting
let cachedToken: {
  token: string;
  expiresAt: number;
  source: UberResolvedTokenSource;
} | null = null;

// Lock to prevent concurrent token requests
let tokenRequestInProgress = false;

@Injectable()
export class UberEatsTokenService {
  constructor(
    private configService: ConfigService,
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  private sanitizeToken(raw?: string | null): string {
    if (!raw) return '';
    const token = raw.trim();
    if (!token) return '';
    if (token.toLowerCase() === 'none') return '';
    if (token.includes('<ACCESS_TOKEN>')) return '';
    return token;
  }

  private resolveTokenEndpoint(): string {
    if (this.configService.get<string>('UBEREATS_OAUTH_TOKEN_URL')?.trim()) {
      return this.configService.get<string>('UBEREATS_OAUTH_TOKEN_URL')!.trim();
    }
    const env = (this.configService.get<string>('UBEREATS_ENVIRONMENT') || 'sandbox')
      .toLowerCase()
      .trim();
    return env === 'production'
      ? 'https://auth.uber.com/oauth/v2/token'
      : 'https://sandbox-login.uber.com/oauth/v2/token';
  }

  private resolveClientCredentialsScope(): string {
    return (
      this.configService.get<string>('UBEREATS_CLIENT_CREDENTIALS_SCOPES') ||
      this.configService.get<string>('UBEREATS_OAUTH_SCOPES') ||
      'eats.store.read eats.store.orders.read eats.store.status.write'
    );
  }

  private tokenIsFresh(expiresAt?: number): boolean {
    if (!expiresAt) return true;
    // Add 5 minute buffer to ensure token doesn't expire mid-request
    return expiresAt - Date.now() > 5 * 60 * 1000;
  }

  /**
   * Exchange client credentials for access token
   */
  private async exchangeClientCredentialsToken(tenantId: string): Promise<UberResolvedToken> {
    const clientId = this.configService.get<string>('UBEREATS_CLIENT_ID')?.trim();
    const clientSecret = this.configService.get<string>('UBEREATS_CLIENT_SECRET')?.trim();

    if (!clientId) {
      return {
        token: '',
        source: 'none',
        warning: 'Uber Eats not configured',
        setupGuide: 'To enable Uber Eats integration, apply for developer access at https://developer.uber.com/docs/eats and configure credentials in .env.local',
        errorDetails: 'UBEREATS_CLIENT_ID is missing',
      };
    }

    if (!clientSecret) {
      return {
        token: '',
        source: 'none',
        warning: 'Uber Eats credentials incomplete',
        setupGuide: 'Configure UBEREATS_CLIENT_SECRET in .env.local',
        errorDetails: 'UBEREATS_CLIENT_SECRET is missing',
      };
    }

    try {
      const tokenUrl = this.resolveTokenEndpoint();
      const scope = this.resolveClientCredentialsScope();

      console.log('[Uber Eats Token] Attempting client credentials exchange');
      console.log('[Uber Eats Token] Token URL:', tokenUrl);
      console.log('[Uber Eats Token] Scope:', scope);
      console.log('[Uber Eats Token] Client ID:', clientId.substring(0, 8) + '...');

      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: scope,
      });

      console.log('[Uber Eats Token] Request body prepared');

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        cache: 'no-store',
      });

      console.log('[Uber Eats Token] Response status:', tokenRes.status);

      const tokenData = await tokenRes.json().catch(() => ({}));
      console.log('[Uber Eats Token] Response data:', JSON.stringify(tokenData, null, 2));

      const accessToken = this.sanitizeToken(
        typeof tokenData.access_token === 'string' ? tokenData.access_token : ''
      );

      if (!tokenRes.ok || !accessToken) {
        const details =
          (tokenData as { error_description?: string; error?: string }).error_description ||
          (tokenData as { error?: string }).error ||
          `HTTP ${tokenRes.status}`;

        console.error('[Uber Eats Token] Token exchange failed:', details);

        return {
          token: '',
          source: 'none',
          warning: `Uber token exchange failed (${details})`,
          setupGuide: 'Check your Uber Eats credentials in .env.local and ensure your app is approved for the required scopes.',
          errorDetails: details,
        };
      }

      const expiresIn =
        typeof tokenData.expires_in === 'number' && Number.isFinite(tokenData.expires_in)
          ? tokenData.expires_in
          : 3600;

      console.log('[Uber Eats Token] Token obtained successfully, expires in:', expiresIn, 'seconds');

      // Update global cache
      cachedToken = {
        token: accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
        source: 'client_credentials',
      };

      // Cache in Redis
      await this.redis.setToken('ubereats', tenantId, accessToken, expiresIn);

      return {
        token: accessToken,
        source: 'client_credentials',
      };
    } catch (error) {
      console.error('[Uber Eats Token] Exception during token exchange:', error);
      return {
        token: '',
        source: 'none',
        warning: error instanceof Error ? error.message : 'token_exchange_unknown_error',
        setupGuide: 'Ensure your Uber Eats credentials are correctly configured in .env.local',
        errorDetails: error instanceof Error ? error.stack : String(error),
      };
    }
  }

  /**
   * Resolve Uber Eats access token with caching
   */
  async resolveAccessToken(tenantId: string): Promise<UberResolvedToken> {
    // Check global cache first to prevent rate limiting
    if (cachedToken && this.tokenIsFresh(cachedToken.expiresAt)) {
      console.log('[Uber Eats Token] Using cached token (expires in:', Math.round((cachedToken.expiresAt - Date.now()) / 1000), 'seconds)');
      return { token: cachedToken.token, source: cachedToken.source };
    }

    // Check Redis cache
    const redisToken = await this.redis.getToken('ubereats', tenantId);
    if (redisToken) {
      console.log('[Uber Eats Token] Using Redis cached token');
      return { token: redisToken, source: 'oauth_connection' };
    }

    // Check database for stored OAuth token
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_platform_platformStoreId: {
          tenantId,
          platform: 'UBEREATS',
          platformStoreId: 'default',
        },
      },
    });

    if (integration && integration.accessTokenEnc && integration.tokenExpiresAt) {
      // TODO: Decrypt token (AES-256)
      const accessToken = integration.accessTokenEnc; // Will be decrypted

      if (this.tokenIsFresh(integration.tokenExpiresAt.getTime())) {
        console.log('[Uber Eats Token] Using stored OAuth token from database');

        // Update global cache
        cachedToken = {
          token: accessToken,
          expiresAt: integration.tokenExpiresAt.getTime(),
          source: 'oauth_connection',
        };

        return { token: accessToken, source: 'oauth_connection' };
      }
    }

    // Check environment variable
    const envToken = this.sanitizeToken(this.configService.get<string>('UBEREATS_BEARER_TOKEN'));
    if (envToken) {
      console.log('[Uber Eats Token] Using environment bearer token');

      // Update global cache with long expiry for env tokens
      cachedToken = {
        token: envToken,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        source: 'env_bearer_token',
      };

      return { token: envToken, source: 'env_bearer_token' };
    }

    // Prevent concurrent token requests
    if (tokenRequestInProgress) {
      console.log('[Uber Eats Token] Token request already in progress, waiting...');

      // Wait for the in-progress request (simple polling)
      let attempts = 0;
      while (tokenRequestInProgress && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      // Check if token was cached while we were waiting
      if (cachedToken && this.tokenIsFresh(cachedToken.expiresAt)) {
        console.log('[Uber Eats Token] Using token from concurrent request');
        return { token: cachedToken.token, source: cachedToken.source };
      }
    }

    // Request new token
    console.log('[Uber Eats Token] Attempting client credentials exchange');
    tokenRequestInProgress = true;

    try {
      const result = await this.exchangeClientCredentialsToken(tenantId);
      return result;
    } finally {
      tokenRequestInProgress = false;
    }
  }
}