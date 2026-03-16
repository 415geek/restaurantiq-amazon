import { Body, Controller, Headers, Post } from '@nestjs/common';
import { NovaActService } from './nova-act.service';

@Controller('nova-act')
export class NovaActController {
  constructor(private readonly novaActService: NovaActService) {}

  /**
   * OpenAI-compatible endpoint for Nova Act market scan.
   *
   * This matches the expectations from `lib/server/adapters/nova-act-market-scan.ts`:
   * - POST NOVA_ACT_ENDPOINT
   * - Authorization: Bearer NOVA_ACT_API_KEY
   * - Body: { model, messages, temperature, max_tokens }
   * - Response: { choices: [{ message: { content: string } }] }
   */
  @Post('market-scan')
  async marketScan(
    @Headers('authorization') authorization: string,
    @Body() body: any,
  ) {
    this.novaActService.validateApiKey(authorization);

    const data = await this.novaActService.proxyToNovaGateway(body);

    // Ensure OpenAI-style response shape even if upstream returns plain text
    if (typeof data === 'string') {
      return {
        choices: [
          {
            message: {
              content: data,
            },
          },
        ],
      };
    }

    if (data?.choices?.[0]?.message?.content) {
      return data;
    }

    // If upstream returned JSON with menuItems/campaigns directly, wrap it as content
    return {
      choices: [
        {
          message: {
            content: JSON.stringify(data),
          },
        },
      ],
    };
  }
}

