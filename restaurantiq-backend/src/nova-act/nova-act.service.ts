import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface OpenAIStyleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIStyleRequestBody {
  model: string;
  messages: OpenAIStyleMessage[];
  temperature?: number;
  max_tokens?: number;
}

@Injectable()
export class NovaActService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Very small auth layer: check Bearer token against NOVA_ACT_API_KEY
   */
  validateApiKey(authorizationHeader?: string) {
    const expected = this.configService.get<string>('NOVA_ACT_API_KEY');
    if (!expected) {
      // If backend is not configured, reject explicit external calls
      throw new UnauthorizedException('NOVA_ACT_API_KEY not configured on backend');
    }

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (token !== expected) {
      throw new UnauthorizedException('Invalid NOVA_ACT_API_KEY');
    }
  }

  /**
   * Proxy an OpenAI-style chat request to Amazon Nova / Bedrock gateway.
   *
   * Note:
   * - This service assumes you already have an HTTP-accessible Nova gateway
   *   (e.g. API Gateway/Lambda or an internal service) that accepts
   *   OpenAI-compatible requests with NOVA_API_KEY.
   * - The gateway URL is configured via NOVA_ACT_UPSTREAM_URL on the backend.
   */
  async proxyToNovaGateway(body: OpenAIStyleRequestBody) {
    const upstreamUrl = this.configService.get<string>('NOVA_ACT_UPSTREAM_URL');
    const upstreamKey = this.configService.get<string>('NOVA_API_KEY') 
      || this.configService.get<string>('AWS_NOVA_API_KEY');

    if (!upstreamUrl || !upstreamKey) {
      throw new Error('Nova Act upstream not configured (NOVA_ACT_UPSTREAM_URL + NOVA_API_KEY/AWS_NOVA_API_KEY required)');
    }

    const payload = {
      model: body.model || 'nova-2-lite-v1',
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 2000,
    };

    const response = await axios.post(upstreamUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${upstreamKey}`,
      },
    });

    return response.data;
  }
}

