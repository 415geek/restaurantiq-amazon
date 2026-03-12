import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private subscriber: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379/0';
    
    this.client = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });

    // Test connection
    await this.client.ping();
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.subscriber.quit();
    console.log('🔌 Redis disconnected');
  }

  // String operations
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.client.setex(key, ttl, value);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  // JSON operations (for complex data)
  async jsonGet(key: string): Promise<any> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async jsonSet(key: string, value: any, ttl?: number): Promise<'OK'> {
    const jsonValue = JSON.stringify(value);
    if (ttl) {
      return this.client.setex(key, ttl, jsonValue);
    }
    return this.client.set(key, jsonValue);
  }

  // Cache helpers
  async cacheGet<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  async cacheSet<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  // Token cache (for Uber Eats OAuth)
  async getToken(platform: string, tenantId: string): Promise<string | null> {
    return this.hget(`token:${platform}`, tenantId);
  }

  async setToken(platform: string, tenantId: string, token: string, ttl: number = 3600): Promise<void> {
    await this.hset(`token:${platform}`, tenantId, token);
    await this.client.expire(`token:${platform}`, ttl);
  }
}