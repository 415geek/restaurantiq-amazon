import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey || '',
    });
  }

  async chat(options: {
    model: string;
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens?: number;
    temperature?: number;
  }) {
    try {
      const messages = options.system
        ? [{ role: 'system' as const, content: options.system }, ...options.messages]
        : options.messages;

      const response = await this.client.chat.completions.create({
        model: options.model,
        messages,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.3,
      });

      return {
        text: response.choices[0]?.message?.content || '',
        model: response.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        },
      };
    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      throw error;
    }
  }

  async chatJson<T>(options: {
    model: string;
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
      console.error('❌ Failed to parse JSON from OpenAI response:', response.text);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  isConfigured(): boolean {
    return !!this.configService.get<string>('OPENAI_API_KEY');
  }
}