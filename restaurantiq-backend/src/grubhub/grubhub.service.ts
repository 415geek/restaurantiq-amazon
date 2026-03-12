import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GrubHubService {
  constructor(private configService: ConfigService) {}

  // TODO: Implement GrubHub Partner API integration
  async getOAuthUrl(tenantId: string) {
    return { url: 'not_implemented' };
  }

  async handleWebhook(payload: any) {
    return { received: true };
  }
}