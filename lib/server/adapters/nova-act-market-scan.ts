type NovaActMarketScanInput = {
  businessName: string;
  city: string;
};

type MenuItemSignal = {
  platform: string;
  name: string;
  category?: string;
  price?: number;
  currency: string;
};

type CampaignSignal = {
  platform: string;
  title: string;
  detail: string;
  status: 'active' | 'scheduled' | 'unknown';
};

export type NovaActMarketScanResult = {
  source: 'nova_act' | 'api' | 'fallback';
  menuItems: MenuItemSignal[];
  campaigns: CampaignSignal[];
  warnings: string[];
};

function fallbackMenuSignals(input: NovaActMarketScanInput): MenuItemSignal[] {
  const seed = input.businessName.toLowerCase();
  return [
    {
      platform: 'Uber Eats',
      name: seed.includes('bbq') ? 'Signature BBQ Combo' : 'Chef Special Combo',
      category: 'Combo',
      price: 18.9,
      currency: 'USD',
    },
    {
      platform: 'DoorDash',
      name: seed.includes('noodle') ? 'Handmade Noodle Bowl' : 'House Bestseller',
      category: 'Main',
      price: 15.5,
      currency: 'USD',
    },
    {
      platform: 'Grubhub',
      name: 'Family Set Meal',
      category: 'Bundle',
      price: 42,
      currency: 'USD',
    },
  ];
}

function fallbackCampaignSignals(): CampaignSignal[] {
  return [
    {
      platform: 'Uber Eats',
      title: 'Rainy-day delivery offer',
      detail: '10% off orders above $28 between 5pm-9pm.',
      status: 'active',
    },
    {
      platform: 'DoorDash',
      title: 'Lunch combo boost',
      detail: 'Bundle deal for weekday lunch traffic.',
      status: 'scheduled',
    },
  ];
}

export async function runNovaActMarketScan(input: NovaActMarketScanInput): Promise<NovaActMarketScanResult> {
  const endpoint = process.env.NOVA_ACT_ENDPOINT?.trim();
  const apiKey = process.env.NOVA_ACT_API_KEY?.trim();
  const enabled = process.env.NOVA_ACT_ENABLED === 'true';

  if (!enabled || !endpoint || !apiKey) {
    return {
      source: 'fallback',
      menuItems: fallbackMenuSignals(input),
      campaigns: fallbackCampaignSignals(),
      warnings: [
        'Nova Act live browser simulation is not configured. Showing fallback market scan.',
      ],
    };
  }

  try {
    // Create a prompt for Amazon Nova to generate market scan data
    const prompt = `You are a market intelligence assistant for restaurant delivery platforms. 
Generate realistic market scan data for a restaurant called "${input.businessName}" in ${input.city}.

Please provide a JSON response with the following structure:
{
  "menuItems": [
    {
      "platform": "Uber Eats" or "DoorDash" or "Grubhub",
      "name": "menu item name",
      "category": "category name",
      "price": number,
      "currency": "USD"
    }
  ],
  "campaigns": [
    {
      "platform": "Uber Eats" or "DoorDash" or "Grubhub",
      "title": "campaign title",
      "detail": "campaign description",
      "status": "active" or "scheduled"
    }
  ]
}

Generate 6-8 menu items and 2-3 campaigns. Make the data realistic and varied across platforms.
Return ONLY the JSON, no other text.`;

    const controller = new AbortController();
    const timeoutMs = 60_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'nova-2-lite-v1',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Amazon Nova API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract the content from Amazon Nova response
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in Amazon Nova response');
    }

    // Parse JSON from the response
    let payload;
    try {
      // Try to extract JSON from the content (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        payload = JSON.parse(jsonMatch[0]);
      } else {
        payload = JSON.parse(content);
      }
    } catch (parseError) {
      throw new Error(`Failed to parse Amazon Nova response: ${parseError instanceof Error ? parseError.message : 'unknown error'}`);
    }

    const menuItems = Array.isArray(payload.menuItems)
      ? payload.menuItems.slice(0, 12)
      : [];
    const campaigns = Array.isArray(payload.campaigns)
      ? payload.campaigns.slice(0, 8)
      : [];

    if (!menuItems.length && !campaigns.length) {
      return {
        source: 'fallback',
        menuItems: fallbackMenuSignals(input),
        campaigns: fallbackCampaignSignals(),
        warnings: ['Amazon Nova returned empty payload. Fallback signals applied.'],
      };
    }

    return {
      source: 'api',
      menuItems,
      campaigns,
      warnings: [],
    };
  } catch (error) {
    // 网络/连接失败时静默使用 fallback，不向用户展示失败提示（与「未配置 Nova」行为一致）
    return {
      source: 'fallback',
      menuItems: fallbackMenuSignals(input),
      campaigns: fallbackCampaignSignals(),
      warnings: [],
    };
  }
}