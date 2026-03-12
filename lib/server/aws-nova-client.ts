/**
 * AWS Nova / Bedrock Integration
 * Provides access to AWS Nova models via Bedrock API
 */

export interface NovaMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NovaCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface NovaCompletionResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * AWS Nova Client for Bedrock API
 */
export class NovaClient {
  private apiKey: string;
  private region: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.AWS_NOVA_API_KEY || '';
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.baseUrl = `https://bedrock-runtime.${this.region}.amazonaws.com`;

    if (!this.apiKey) {
      console.warn('[Nova Client] AWS_NOVA_API_KEY not configured');
    }
  }

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Generate a completion using AWS Nova
   */
  async complete(
    messages: NovaMessage[],
    options: NovaCompletionOptions = {}
  ): Promise<NovaCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error('AWS Nova API key not configured');
    }

    const model = options.model || 'amazon.nova-pro-v1:0';
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 1000;
    const topP = options.topP ?? 0.9;

    try {
      const response = await fetch(`${this.baseUrl}/model/${model}/converse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Amz-Bedrock-Model': model,
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            content: [{ text: msg.content }],
          })),
          inferenceConfig: {
            temperature,
            maxTokens,
            topP,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AWS Nova API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // Extract the response content
      const content = data.output?.message?.content?.[0]?.text || '';

      return {
        content,
        model,
        usage: data.usage ? {
          inputTokens: data.usage.inputTokens || 0,
          outputTokens: data.usage.outputTokens || 0,
          totalTokens: data.usage.totalTokens || 0,
        } : undefined,
      };
    } catch (error) {
      console.error('[Nova Client] Error generating completion:', error);
      throw error;
    }
  }

  /**
   * Simple text completion (single message)
   */
  async completeText(
    prompt: string,
    options: NovaCompletionOptions = {}
  ): Promise<string> {
    const response = await this.complete(
      [{ role: 'user', content: prompt }],
      options
    );
    return response.content;
  }

  /**
   * Generate a chat completion
   */
  async chat(
    messages: NovaMessage[],
    options: NovaCompletionOptions = {}
  ): Promise<string> {
    const response = await this.complete(messages, options);
    return response.content;
  }
}

// Export singleton instance
export const novaClient = new NovaClient();

/**
 * Helper function to generate a completion
 */
export async function generateNovaCompletion(
  prompt: string,
  options?: NovaCompletionOptions
): Promise<string> {
  return novaClient.completeText(prompt, options);
}

/**
 * Helper function to generate a chat completion
 */
export async function generateNovaChat(
  messages: NovaMessage[],
  options?: NovaCompletionOptions
): Promise<string> {
  return novaClient.chat(messages, options);
}