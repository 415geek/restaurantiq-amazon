import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AnthropicService {
  private client: Anthropic;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.warn('⚠️ ANTHROPIC_API_KEY not configured');
    }
    
    this.client = new Anthropic({
      apiKey: apiKey || '',
    });
  }

  async chat(options: {
    model: 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6' | 'claude-opus-4-6';
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }) {
    try {
      const response = await this.client.messages.create({
        model: options.model,
        max_tokens: options.maxTokens ?? 1024,
        system: options.system,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
      });

      // Extract text content
      const content = response.content[0];
      if (content.type === 'text') {
        return {
          text: content.text,
          model: response.model,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        };
      }

      throw new Error('Unexpected response format from Anthropic');
    } catch (error) {
      console.error('❌ Anthropic API error:', error);
      throw error;
    }
  }

  async chatJson<T>(options: {
    model: 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6' | 'claude-opus-4-6';
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<T> {
    const response = await this.chat(options);
    
    // Parse JSON from response
    try {
      // Try to extract JSON from the text (in case there's extra text)
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      return JSON.parse(response.text) as T;
    } catch (error) {
      console.error('❌ Failed to parse JSON from Anthropic response:', response.text);
      throw new Error('Invalid JSON response from Anthropic');
    }
  }

  isConfigured(): boolean {
    return !!this.configService.get<string>('ANTHROPIC_API_KEY');
  }
}