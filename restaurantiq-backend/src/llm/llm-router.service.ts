import { Injectable } from '@nestjs/common';
import { AnthropicService } from './anthropic.service';
import { OpenaiService } from './openai.service';

export type LlmTier = 'fast' | 'balanced' | 'powerful';

export interface LlmResponse<T = any> {
  text?: string;
  data?: T;
  model: string;
  provider: 'anthropic' | 'openai';
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

@Injectable()
export class LlmRouterService {
  constructor(
    private anthropicService: AnthropicService,
    private openaiService: OpenaiService,
  ) {}

  /**
   * Three-tier model routing strategy:
   * 
   * Tier 1 (Fast/Low Cost): Agent A/B data structuring, execution agents
   *   → Claude Haiku 4.5 (primary) | GPT-4o-mini (fallback)
   *   Estimated monthly cost: $15-30
   * 
   * Tier 2 (Balanced): Agent C factor analysis, daily briefing
   *   → Claude Sonnet 4.6 (primary) | GPT-4o (fallback)
   *   Estimated monthly cost: $40-80
   * 
   * Tier 3 (Deep Reasoning): Agent D comprehensive decision, Impact Score
   *   → Claude Opus 4.6 (primary) | GPT-4o (fallback)
   *   Estimated monthly cost: $80-200
   */

  async chat(options: {
    tier: LlmTier;
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<LlmResponse<string>> {
    const config = this.getModelConfig(options.tier);

    // Try primary provider first
    try {
      if (config.primaryProvider === 'anthropic' && this.anthropicService.isConfigured()) {
        const result = await this.anthropicService.chat({
          model: config.primaryModel,
          system: options.system,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        return {
          text: result.text,
          model: result.model,
          provider: 'anthropic',
          usage: result.usage,
        };
      } else if (config.primaryProvider === 'openai' && this.openaiService.isConfigured()) {
        const result = await this.openaiService.chat({
          model: config.primaryModel,
          system: options.system,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        return {
          text: result.text,
          model: result.model,
          provider: 'openai',
          usage: result.usage,
        };
      }
    } catch (error) {
      console.warn(`⚠️ Primary provider failed for tier ${options.tier}, trying fallback:`, error);
    }

    // Fallback to secondary provider
    try {
      if (config.fallbackProvider === 'anthropic' && this.anthropicService.isConfigured()) {
        const result = await this.anthropicService.chat({
          model: config.fallbackModel,
          system: options.system,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        return {
          text: result.text,
          model: result.model,
          provider: 'anthropic',
          usage: result.usage,
        };
      } else if (config.fallbackProvider === 'openai' && this.openaiService.isConfigured()) {
        const result = await this.openaiService.chat({
          model: config.fallbackModel,
          system: options.system,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        return {
          text: result.text,
          model: result.model,
          provider: 'openai',
          usage: result.usage,
        };
      }
    } catch (error) {
      console.error(`❌ Fallback provider also failed for tier ${options.tier}:`, error);
    }

    throw new Error(`All LLM providers failed for tier ${options.tier}`);
  }

  async chatJson<T>(options: {
    tier: LlmTier;
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<LlmResponse<T>> {
    const config = this.getModelConfig(options.tier);

    // Try primary provider first
    try {
      if (config.primaryProvider === 'anthropic' && this.anthropicService.isConfigured()) {
        const data = await this.anthropicService.chatJson<T>({
          model: config.primaryModel,
          system: options.system,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        return {
          data,
          model: config.primaryModel,
          provider: 'anthropic',
          usage: { inputTokens: 0, outputTokens: 0 }, // Usage not available in JSON mode
        };
      } else if (config.primaryProvider === 'openai' && this.openaiService.isConfigured()) {
        const data = await this.openaiService.chatJson<T>({
          model: config.primaryModel,
          system: options.system,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        return {
          data,
          model: config.primaryModel,
          provider: 'openai',
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      }
    } catch (error) {
      console.warn(`⚠️ Primary provider failed for tier ${options.tier}, trying fallback:`, error);
    }

    // Fallback to secondary provider
    try {
      if (config.fallbackProvider === 'anthropic' && this.anthropicService.isConfigured()) {
        const data = await this.anthropicService.chatJson<T>({
          model: config.fallbackModel,
          system: options.system,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        return {
          data,
          model: config.fallbackModel,
          provider: 'anthropic',
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      } else if (config.fallbackProvider === 'openai' && this.openaiService.isConfigured()) {
        const data = await this.openaiService.chatJson<T>({
          model: config.fallbackModel,
          system: options.system,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        });

        return {
          data,
          model: config.fallbackModel,
          provider: 'openai',
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      }
    } catch (error) {
      console.error(`❌ Fallback provider also failed for tier ${options.tier}:`, error);
    }

    throw new Error(`All LLM providers failed for tier ${options.tier}`);
  }

  private getModelConfig(tier: LlmTier) {
    switch (tier) {
      case 'fast':
        return {
          primaryProvider: 'anthropic' as const,
          primaryModel: 'claude-haiku-4-5-20251001',
          fallbackProvider: 'openai' as const,
          fallbackModel: 'gpt-4o-mini',
        };
      case 'balanced':
        return {
          primaryProvider: 'anthropic' as const,
          primaryModel: 'claude-sonnet-4-6',
          fallbackProvider: 'openai' as const,
          fallbackModel: 'gpt-4o',
        };
      case 'powerful':
        return {
          primaryProvider: 'anthropic' as const,
          primaryModel: 'claude-opus-4-6',
          fallbackProvider: 'openai' as const,
          fallbackModel: 'gpt-4o',
        };
      default:
        throw new Error(`Unknown tier: ${tier}`);
    }
  }

  // Convenience methods for specific tiers
  async fastChat(options: {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }) {
    return this.chat({ ...options, tier: 'fast' });
  }

  async balancedChat(options: {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }) {
    return this.chat({ ...options, tier: 'balanced' });
  }

  async powerfulChat(options: {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }) {
    return this.chat({ ...options, tier: 'powerful' });
  }

  async fastChatJson<T>(options: {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }) {
    return this.chatJson<T>({ ...options, tier: 'fast' });
  }

  async balancedChatJson<T>(options: {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }) {
    return this.chatJson<T>({ ...options, tier: 'balanced' });
  }

  async powerfulChatJson<T>(options: {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }) {
    return this.chatJson<T>({ ...options, tier: 'powerful' });
  }
}