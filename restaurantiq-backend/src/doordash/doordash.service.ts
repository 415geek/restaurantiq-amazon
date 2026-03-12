import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DoorDashService {
  constructor(private configService: ConfigService) {}

  // TODO: Implement DoorDash Drive API integration
  async getOAuthUrl(tenantId: string) {
    return { url: 'not_implemented' };
  }

  async handleWebhook(payload: any) {
    return { received: true };
  }
}