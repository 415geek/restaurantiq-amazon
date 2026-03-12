type JsonSchema = Record<string, unknown>;

type RunOpenAIJsonOptions<T> = {
  model?: string;
  prompt: string;
  schemaName: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
  temperature?: number;
};

export async function runOpenAIJsonSchema<T>({
  model = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-5-mini',
  prompt,
  schemaName,
  schema,
  maxOutputTokens = 2000,
  temperature,
}: RunOpenAIJsonOptions<T>): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: maxOutputTokens,
        ...(typeof temperature === 'number' ? { temperature } : {}),
        text: {
          format: {
            type: 'json_schema',
            name: schemaName,
            schema,
          },
        },
      }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    const text = data?.output_text;
    if (!response.ok || !text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
