import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Simple inline Nova client for NestJS backend.
 * Mirrors the logic in `lib/server/aws-nova-client.ts` but avoids cross-bundle imports.
 */
async function generateNovaTextCompletion(prompt: string, options?: { model?: string; temperature?: number; maxTokens?: number }) {
  const apiKey = (process.env.AWS_NOVA_API_KEY || process.env.NOVA_API_KEY || '').trim();
  const region = process.env.AWS_REGION || 'us-east-1';
  const baseUrl = `https://bedrock-runtime.${region}.amazonaws.com`;

  if (!apiKey) {
    throw new Error('AWS_NOVA_API_KEY (or NOVA_API_KEY) not configured for Nova Act backend');
  }
  if (!apiKey.startsWith('ABSK')) {
    throw new Error('AWS_NOVA_API_KEY format looks invalid for Nova Act backend (expected ABSK*)');
  }

  const model = options?.model || 'amazon.nova-pro-v1:0';
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 1000;

  const response = await fetch(`${baseUrl}/model/${model}/converse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Amz-Bedrock-Model': model,
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        temperature,
        maxTokens,
        topP: 0.9,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`AWS Nova API error (${response.status}): ${errorText}`);
  }

  const data = await response.json().catch(() => ({}));
  const content = data?.output?.message?.content?.[0]?.text;
  if (!content || typeof content !== 'string') {
    throw new Error('Empty content from AWS Nova for Nova Act backend');
  }
  return content as string;
}

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
   * Handle an OpenAI-style chat request directly via AWS Nova / Bedrock.
   *
   * This removes the need for an external Nova Act HTTP gateway.
   */
  async proxyToNovaGateway(body: OpenAIStyleRequestBody) {
    const firstUserMessage = body.messages.find((m) => m.role === 'user');
    if (!firstUserMessage || !firstUserMessage.content) {
      throw new InternalServerErrorException('Nova Act request is missing user content');
    }

    try {
      const raw = await generateNovaTextCompletion(firstUserMessage.content, {
        model: body.model || 'amazon.nova-pro-v1:0',
        temperature: body.temperature ?? 0.7,
        maxTokens: body.max_tokens ?? 2000,
      });

      // Ensure OpenAI-style response shape
      return {
        choices: [
          {
            message: {
              content: raw,
            },
          },
        ],
      };
    } catch (error) {
      // Let caller know Nova failed so frontend can fall back if needed
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Nova Act backend failed to call AWS Nova',
      );
    }
  }
}

