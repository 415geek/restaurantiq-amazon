import { runOpenAIJsonSchema } from '@/lib/server/openai-json';

type JsonSchema = Record<string, unknown>;

type LlmTask = 'ops_intent_parse' | 'ops_risk_review' | 'ops_report';

type RunProviderJsonOptions = {
  task: LlmTask;
  prompt: string;
  schemaName: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
  temperature?: number;
};

type ProviderResult<T> = {
  data: T | null;
  provider: 'openai' | 'claude' | 'none';
  model: string | null;
  warning?: string;
};

const TASK_ROUTING: Record<
  LlmTask,
  {
    primary: { provider: 'openai' | 'claude'; model: string };
    fallback: { provider: 'openai' | 'claude'; model: string };
  }
> = {
  ops_intent_parse: {
    primary: {
      provider: 'openai',
      model: process.env.OPENAI_OPS_PARSE_MODEL || process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini',
    },
    fallback: {
      provider: 'claude',
      model: process.env.CLAUDE_OPS_PARSE_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
    },
  },
  ops_risk_review: {
    primary: {
      provider: 'claude',
      model: process.env.CLAUDE_OPS_REVIEW_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest',
    },
    fallback: {
      provider: 'openai',
      model: process.env.OPENAI_OPS_REVIEW_MODEL || process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4.1-mini',
    },
  },
  ops_report: {
    primary: {
      provider: 'claude',
      model: process.env.CLAUDE_OPS_REPORT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest',
    },
    fallback: {
      provider: 'openai',
      model: process.env.OPENAI_OPS_REPORT_MODEL || process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4.1-mini',
    },
  },
};

function getClaudeKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

function parseJsonObject(text: string) {
  const direct = text.trim();
  try {
    return JSON.parse(direct) as Record<string, unknown>;
  } catch {
    const start = direct.indexOf('{');
    const end = direct.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const sliced = direct.slice(start, end + 1);
      return JSON.parse(sliced) as Record<string, unknown>;
    }
    return null;
  }
}

async function runClaudeJson<T>({
  prompt,
  schema,
  model,
  maxOutputTokens = 1500,
  temperature = 0.1,
}: {
  prompt: string;
  schema: JsonSchema;
  model: string;
  maxOutputTokens?: number;
  temperature?: number;
}) {
  const apiKey = getClaudeKey();
  if (!apiKey) return null;

  const schemaText = JSON.stringify(schema);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxOutputTokens,
      temperature,
      system: [
        'You are a structured JSON generator.',
        'Return ONLY a valid JSON object that matches the schema.',
        'No markdown, no explanation, no backticks.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${prompt}\n\nJSON schema to follow:\n${schemaText}`,
            },
          ],
        },
      ],
    }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  const contentText = Array.isArray(payload?.content)
    ? payload.content
        .map((part: { type?: string; text?: string }) => (part?.type === 'text' ? part.text || '' : ''))
        .join('\n')
    : '';
  if (!contentText.trim()) return null;
  const parsed = parseJsonObject(contentText);
  return (parsed as T | null) ?? null;
}

async function runWithProvider<T>({
  provider,
  model,
  prompt,
  schemaName,
  schema,
  maxOutputTokens,
  temperature,
}: RunProviderJsonOptions & { provider: 'openai' | 'claude'; model: string }) {
  if (provider === 'openai') {
    return runOpenAIJsonSchema<T>({
      model,
      prompt,
      schemaName,
      schema,
      maxOutputTokens,
      temperature,
    });
  }
  return runClaudeJson<T>({
    model,
    prompt,
    schema,
    maxOutputTokens,
    temperature,
  });
}

function providerConfigured(provider: 'openai' | 'claude') {
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(getClaudeKey());
}

export async function runProviderJsonSchema<T>(
  options: RunProviderJsonOptions
): Promise<ProviderResult<T>> {
  const routing = TASK_ROUTING[options.task];
  const first = routing.primary;
  const second = routing.fallback;

  const attempts: Array<{ provider: 'openai' | 'claude'; model: string }> = [first, second];
  const warnings: string[] = [];

  for (const attempt of attempts) {
    if (!providerConfigured(attempt.provider)) {
      warnings.push(`${attempt.provider} key is missing`);
      continue;
    }

    const data = await runWithProvider<T>({
      ...options,
      provider: attempt.provider,
      model: attempt.model,
    });

    if (data) {
      return {
        data,
        provider: attempt.provider,
        model: attempt.model,
        warning: warnings.length ? warnings.join('; ') : undefined,
      };
    }

    warnings.push(`${attempt.provider}:${attempt.model} returned empty/invalid JSON`);
  }

  return {
    data: null,
    provider: 'none',
    model: null,
    warning: warnings.length ? warnings.join('; ') : 'No configured LLM provider available.',
  };
}
