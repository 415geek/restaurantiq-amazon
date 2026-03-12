import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UberEatsTokenService {
  private tokenCachePrefix = 'ubereats:token:';
  private stateCachePrefix = 'ubereats:state:';
  private lockPrefix = 'ubereats:lock:';
  private defaultTTL = 3600; // 1 hour

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    console.log('[Uber Eats Token Service] Initialized');
  }

  /**
   * Cache access token in Redis
   */
  async cacheToken(tenantId: string, token: string, expiresIn: number): Promise<void> {
    const key = `${this.tokenCachePrefix}${tenantId}`;
    const ttl = Math.min(expiresIn - 60, this.defaultTTL); // Subtract 60s buffer
    
    await this.redisService.set(key, token, ttl);
    
    console.log('[Uber Eats Token Service] Token cached', {
      tenantId,
      ttl,
      tokenPreview: token.substring(0, 20) + '...',
    });
  }

  /**
   * Get cached access token
   */
  async getCachedToken(tenantId: string): Promise<string | null> {
    const key = `${this.tokenCachePrefix}${tenantId}`;
    const token = await this.redisService.get(key);
    
    if (token) {
      console.log('[Uber Eats Token Service] Token cache hit', { tenantId });
    }
    
    return token;
  }

  /**
   * Clear cached access token
   */
  async clearCachedToken(tenantId: string): Promise<void> {
    const key = `${this.tokenCachePrefix}${tenantId}`;
    await this.redisService.del(key);
    
    console.log('[Uber Eats Token Service] Token cache cleared', { tenantId });
  }

  /**
   * Cache OAuth state for verification
   */
  async cacheState(state: string, tenantId: string): Promise<void> {
    const key = `${this.stateCachePrefix}${state}`;
    await this.redisService.set(key, tenantId, 600); // 10 minutes
    
    console.log('[Uber Eats Token Service] State cached', {
      state: state.substring(0, 8) + '...',
      tenantId,
    });
  }

  /**
   * Verify and consume OAuth state
   */
  async verifyState(state: string): Promise<string | null> {
    const key = `${this.stateCachePrefix}${state}`;
    const tenantId = await this.redisService.get(key);
    
    if (tenantId) {
      // Consume the state (delete it)
      await this.redisService.del(key);
      console.log('[Uber Eats Token Service] State verified', {
        state: state.substring(0, 8) + '...',
        tenantId,
      });
    }
    
    return tenantId;
  }

  /**
   * Acquire lock for token refresh (prevent concurrent refreshes)
   */
  async acquireLock(tenantId: string, ttl: number = 30): Promise<boolean> {
    const key = `${this.lockPrefix}${tenantId}`;
    
    // Try to set the key with NX (only if not exists)
    const result = await this.redisService.set(key, '1', ttl);
    
    if (result === 'OK') {
      console.log('[Uber Eats Token Service] Lock acquired', { tenantId });
      return true;
    }
    
    console.log('[Uber Eats Token Service] Lock already held', { tenantId });
    return false;
  }

  /**
   * Release lock
   */
  async releaseLock(tenantId: string): Promise<void> {
    const key = `${this.lockPrefix}${tenantId}`;
    await this.redisService.del(key);
    
    console.log('[Uber Eats Token Service] Lock released', { tenantId });
  }

  /**
   * Wait for lock to be released (with timeout)
   */
  async waitForLock(tenantId: string, timeout: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const hasLock = await this.redisService.exists(`${this.lockPrefix}${tenantId}`);
      
      if (!hasLock) {
        console.log('[Uber Eats Token Service] Lock released, proceeding', { tenantId });
        return;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for token refresh lock');
  }

  /**
   * Get token with automatic refresh and lock protection
   * This prevents multiple concurrent requests from triggering multiple refreshes
   */
  async getTokenWithRefresh(
    tenantId: string,
    refreshCallback: () => Promise<string>,
  ): Promise<string> {
    // Check cache first
    const cachedToken = await this.getCachedToken(tenantId);
    if (cachedToken) {
      return cachedToken;
    }

    // Try to acquire lock
    const lockAcquired = await this.acquireLock(tenantId);
    
    if (lockAcquired) {
      try {
        // We have the lock, perform the refresh
        console.log('[Uber Eats Token Service] Performing token refresh', { tenantId });
        const newToken = await refreshCallback();
        return newToken;
      } finally {
        await this.releaseLock(tenantId);
      }
    } else {
      // Another request is refreshing, wait for it
      console.log('[Uber Eats Token Service] Waiting for token refresh', { tenantId });
      await this.waitForLock(tenantId);
      
      // After waiting, check cache again
      const cachedToken = await this.getCachedToken(tenantId);
      if (cachedToken) {
        return cachedToken;
      }
      
      // If still no token, something went wrong
      throw new Error('Failed to obtain token after waiting for refresh');
    }
  }

  /**
   * Get token usage statistics
   */
  async getTokenStats(tenantId: string): Promise<{
    cached: boolean;
    ttl?: number;
  }> {
    const key = `${this.tokenCachePrefix}${tenantId}`;
    const exists = await this.redisService.exists(key);
    
    if (!exists) {
      return { cached: false };
    }
    
    // Get TTL
    const ttl = await this.redisService.client.ttl(key);
    
    return {
      cached: true,
      ttl: ttl > 0 ? ttl : undefined,
    };
  }

  /**
   * Clear all cached tokens for a tenant
   */
  async clearAllTenantData(tenantId: string): Promise<void> {
    await this.clearCachedToken(tenantId);
    
    // Note: We don't clear locks here as they should expire naturally
    
    console.log('[Uber Eats Token Service] All tenant data cleared', { tenantId });
  }
}