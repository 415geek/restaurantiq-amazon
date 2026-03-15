# RestaurantIQ Amazon Nova Hackathon - Critical Fixes

## CONTEXT
RestaurantIQ.ai is competing in Amazon Nova AI Hackathon. Demo tested on 2026-03-15.
Current state: 45/100 on Nova integration. Needs 85+ to win.

## CRITICAL BUGS (Fix in Order)

### BUG-1: Invalid LLM Model Names
```
FILE: lib/server/llm/provider-json.ts

FIND: 'gpt-4.1-mini'
REPLACE: 'gpt-4o-mini'

FIND: 'claude-3-7-sonnet-latest' 
REPLACE: 'claude-3-5-sonnet-latest'

FIND: 'claude-3-5-haiku-latest'
REPLACE: 'claude-3-haiku-20240307'
```

### BUG-2: Settings Page Shows Fake Models
```
FILE: components/settings/SettingsClient.tsx

Search for "gpt-5" references and replace with actual Nova models:
- 'amazon.nova-lite-v1:0' for simple tasks
- 'amazon.nova-pro-v1:0' for analysis
```

### BUG-3: Language Mixing (EN mode shows Chinese)
```
FILES: 
- components/dashboard/AgentMetricCard.tsx
- components/dashboard/OperationalSnapshot.tsx

ISSUE: Labels like "总营收", "平均客单价", "日均订单", "折扣率" 
       appear even when lang='en'

FIX: Ensure all text uses copy[lang] pattern:
  {lang === 'zh' ? '总营收' : 'Total Revenue'}
```

### BUG-4: Empty Charts
```
FILE: components/dashboard/OperationalSnapshot.tsx

ISSUE: Revenue Trend shows "--", Platform Order Mix shows empty

FIX: Add fallback demo data when no real data:
const mockRevenueTrend = [
  { month: 'Oct', revenue: 28500 },
  { month: 'Nov', revenue: 31200 },
  { month: 'Dec', revenue: 35800 },
  { month: 'Jan', revenue: 33400 },
  { month: 'Feb', revenue: 29100 },
];

const mockPlatformMix = [
  { platform: 'UberEats', percentage: 45 },
  { platform: 'DoorDash', percentage: 35 },
  { platform: 'Dine-in', percentage: 20 },
];
```

## NOVA INTEGRATION (After Bugs Fixed)

### Add Nova as Primary LLM Provider
```typescript
// lib/server/nova-llm-provider.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

export async function invokeNova(prompt: string, model = 'amazon.nova-pro-v1:0') {
  const command = new InvokeModelCommand({
    modelId: model,
    body: JSON.stringify({
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 2000, temperature: 0.7 }
    }),
    contentType: 'application/json',
  });
  
  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.output.message.content[0].text;
}
```

### Update provider-json.ts to Use Nova
```typescript
// Add to TASK_ROUTING
ops_intent_parse: {
  primary: {
    provider: 'nova',
    model: 'amazon.nova-lite-v1:0',
  },
  // ... keep existing fallbacks
}
```

## DEPLOYMENT
```bash
ssh ubuntu@34.220.87.202
cd /var/www/restaurantiq
git pull
npm run build
pm2 restart all
```

## SUCCESS CRITERIA
- [ ] No "gpt-4.1-mini" or "gpt-5" in codebase
- [ ] Daily Briefing shows "Live" badge
- [ ] All text in English when lang=en
- [ ] Charts show data (mock or real)
- [ ] Nova models visible in Settings
