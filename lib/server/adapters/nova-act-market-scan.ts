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
  // NOTE: This adapter is intentionally designed as a progressive integration layer.
  // When NOVA_ACT_ENDPOINT is configured, replace the fallback branch with a real browser-simulated crawl task.
  const endpoint = process.env.NOVA_ACT_ENDPOINT?.trim();
  const apiKey = process.env.NOVA_ACT_API_KEY?.trim();
  const enabled = process.env.NOVA_ACT_ENABLED === 'true';

  if (!enabled || !endpoint) {
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
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        businessName: input.businessName,
        city: input.city,
        objective: 'fetch_delivery_menu_pricing_and_campaign_signals',
      }),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload || typeof payload !== 'object') {
      throw new Error(`nova_act_http_${response.status}`);
    }

    const menuItems = Array.isArray((payload as { menuItems?: unknown }).menuItems)
      ? ((payload as { menuItems: MenuItemSignal[] }).menuItems ?? []).slice(0, 12)
      : [];
    const campaigns = Array.isArray((payload as { campaigns?: unknown }).campaigns)
      ? ((payload as { campaigns: CampaignSignal[] }).campaigns ?? []).slice(0, 8)
      : [];

    if (!menuItems.length && !campaigns.length) {
      return {
        source: 'fallback',
        menuItems: fallbackMenuSignals(input),
        campaigns: fallbackCampaignSignals(),
        warnings: ['Nova Act returned empty payload. Fallback signals applied.'],
      };
    }

    return {
      source: 'nova_act',
      menuItems,
      campaigns,
      warnings: [],
    };
  } catch (error) {
    return {
      source: 'fallback',
      menuItems: fallbackMenuSignals(input),
      campaigns: fallbackCampaignSignals(),
      warnings: [
        `Nova Act market scan failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      ],
    };
  }
}

