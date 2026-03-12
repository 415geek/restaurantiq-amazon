import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  query: z.string().min(2),
});

type AddressSuggestion = {
  id: string;
  description: string;
  placeId?: string;
  lat?: number;
  lng?: number;
};

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid autocomplete payload.', suggestions: [] }, { status: 400 });
  }

  const query = parsed.data.query.trim();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      source: 'fallback',
      suggestions: [
        { id: 'fallback-1', description: query },
      ] satisfies AddressSuggestion[],
      warning: 'GOOGLE_MAPS_API_KEY is missing. Returning fallback suggestion.',
    });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', query);
    url.searchParams.set('types', 'address');
    url.searchParams.set('key', apiKey);
    const autocompleteRes = await fetch(url, { cache: 'no-store' });
    const autocompleteData = await autocompleteRes.json().catch(() => ({}));
    const predictions: unknown[] = Array.isArray(autocompleteData.predictions)
      ? autocompleteData.predictions.slice(0, 6)
      : [];

    const suggestions = (
      await Promise.all(
        predictions.map(async (prediction: unknown, index: number) => {
          const row = prediction as Record<string, unknown>;
          const placeId = typeof row.place_id === 'string' ? row.place_id : undefined;
          const description = typeof row.description === 'string' ? row.description : query;
          if (!placeId) {
            return {
              id: `address-${index}`,
              description,
            } satisfies AddressSuggestion;
          }

          try {
            const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
            detailsUrl.searchParams.set('place_id', placeId);
            detailsUrl.searchParams.set('fields', 'geometry');
            detailsUrl.searchParams.set('key', apiKey);
            const detailsRes = await fetch(detailsUrl, { cache: 'no-store' });
            const details = await detailsRes.json().catch(() => ({}));
            const geometry = details?.result?.geometry as Record<string, unknown> | undefined;
            const location = geometry?.location as Record<string, unknown> | undefined;
            return {
              id: `address-${placeId}`,
              description,
              placeId,
              lat: safeNumber(location?.lat),
              lng: safeNumber(location?.lng),
            } satisfies AddressSuggestion;
          } catch {
            return {
              id: `address-${placeId}`,
              description,
              placeId,
            } satisfies AddressSuggestion;
          }
        })
      )
    ).filter((item) => item.description.trim().length > 0);

    return NextResponse.json({
      source: 'live',
      suggestions,
    });
  } catch (error) {
    return NextResponse.json({
      source: 'fallback',
      suggestions: [{ id: 'fallback-1', description: query }],
      warning: error instanceof Error ? error.message : 'Address autocomplete failed.',
    });
  }
}
