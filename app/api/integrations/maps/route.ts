import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ query: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid maps request.' }, { status: 400 });

  const mockPayload = {
    source: 'mock',
    area: parsed.data.query,
    traffic_level: 'medium',
    foot_traffic_signal: 'event_nearby',
    nearby_points: [
      { name: 'Office Tower A', type: 'office', walk_minutes: 6 },
      { name: 'Chinatown Night Market', type: 'event', walk_minutes: 11 },
      { name: 'Transit Station', type: 'transport', walk_minutes: 4 },
    ],
  };

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json(mockPayload);

  try {
    const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    geocodeUrl.searchParams.set('address', parsed.data.query);
    geocodeUrl.searchParams.set('key', apiKey);
    const geocodeRes = await fetch(geocodeUrl, { cache: 'no-store' });
    if (!geocodeRes.ok) throw new Error(`Google Geocoding failed (${geocodeRes.status})`);
    const geocodeData = await geocodeRes.json();
    if (geocodeData.status !== 'OK' || !geocodeData.results?.length) {
      throw new Error(`Google Geocoding status: ${geocodeData.status || 'UNKNOWN'}`);
    }

    const top = geocodeData.results[0];
    const { lat, lng } = top.geometry.location;

    const placesUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    placesUrl.searchParams.set('query', `${parsed.data.query} restaurants`);
    placesUrl.searchParams.set('key', apiKey);
    const placesRes = await fetch(placesUrl, { cache: 'no-store' });
    if (!placesRes.ok) throw new Error(`Google Places failed (${placesRes.status})`);
    const placesData = await placesRes.json();

    const nearbyPoints = (placesData.results ?? []).slice(0, 5).map((p: { name?: string; types?: string[]; user_ratings_total?: number; rating?: number }) => ({
      name: p.name ?? 'Unknown',
      type: p.types?.[0] ?? 'place',
      rating: p.rating ?? null,
      review_count: p.user_ratings_total ?? null,
    }));

    return NextResponse.json({
      source: 'live',
      area: parsed.data.query,
      geocode: {
        formatted_address: top.formatted_address,
        lat,
        lng,
        place_id: top.place_id,
      },
      traffic_level: 'unknown',
      foot_traffic_signal: nearbyPoints.length >= 3 ? 'restaurant_cluster_detected' : 'limited_density',
      nearby_points: nearbyPoints.length ? nearbyPoints : mockPayload.nearby_points,
      warning: placesData.status && placesData.status !== 'OK' ? `Google Places status: ${placesData.status}` : undefined,
    });
  } catch (error) {
    return NextResponse.json({
      ...mockPayload,
      source: 'fallback',
      warning: error instanceof Error ? error.message : 'Google Maps/Places request failed. Using mock response.',
    });
  }
}
