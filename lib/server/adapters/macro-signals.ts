export type MacroSnapshot = {
  source: 'mock' | 'live' | 'fallback';
  city: string;
  weather_alert: string;
  temperature_f: number;
  precipitation_probability: number;
  demand_impact_signal: string;
  traffic_level: string;
  foot_traffic_signal: string;
  nearby_points: Array<{ name: string; type: string; walk_minutes?: number; rating?: number | null; review_count?: number | null }>;
  factors: Array<{ domain: 'weather' | 'event' | 'traffic'; signal: string; impactWindow: 'today' | 'this_week' | 'this_month' }>;
  warning?: string;
};

export async function getMacroSignalsSnapshot(city = 'San Francisco'): Promise<MacroSnapshot> {
  const fallback = {
    source: 'mock' as const,
    city,
    weather_alert: 'Heavy rain expected after 5pm',
    temperature_f: 54,
    precipitation_probability: 78,
    demand_impact_signal: 'delivery_up',
    traffic_level: 'medium',
    foot_traffic_signal: 'event_nearby',
    nearby_points: [
      { name: 'Office Tower A', type: 'office', walk_minutes: 6 },
      { name: 'Chinatown Night Market', type: 'event', walk_minutes: 11 },
      { name: 'Transit Station', type: 'transport', walk_minutes: 4 },
    ],
    factors: [
      { domain: 'weather' as const, signal: 'rain probability elevated', impactWindow: 'today' as const },
      { domain: 'event' as const, signal: 'neighborhood demand event detected nearby', impactWindow: 'this_week' as const },
      { domain: 'traffic' as const, signal: 'moderate traffic baseline', impactWindow: 'today' as const },
    ],
  };

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return fallback;

  try {
    const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    geocodeUrl.searchParams.set('address', city);
    geocodeUrl.searchParams.set('key', apiKey);
    const geocodeRes = await fetch(geocodeUrl, { cache: 'no-store' });
    if (!geocodeRes.ok) throw new Error(`Google Geocoding failed (${geocodeRes.status})`);
    const geocodeData = await geocodeRes.json();
    if (geocodeData.status !== 'OK' || !geocodeData.results?.length) {
      throw new Error(`Google Geocoding status: ${geocodeData.status || 'UNKNOWN'}`);
    }

    const top = geocodeData.results[0];
    const { lat, lng } = top.geometry.location as { lat: number; lng: number };

    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude', String(lat));
    weatherUrl.searchParams.set('longitude', String(lng));
    weatherUrl.searchParams.set('current', 'temperature_2m,precipitation_probability,rain');
    weatherUrl.searchParams.set('timezone', 'auto');
    const weatherRes = await fetch(weatherUrl, { cache: 'no-store' });
    if (!weatherRes.ok) throw new Error(`Open-Meteo failed (${weatherRes.status})`);
    const weatherData = await weatherRes.json();

    const current = weatherData.current ?? {};
    const tempC = Number(current.temperature_2m ?? 12);
    const precipProb = Number(current.precipitation_probability ?? 20);
    const rain = Number(current.rain ?? 0);
    const tempF = Math.round(tempC * 9 / 5 + 32);

    const placesUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    placesUrl.searchParams.set('query', `${city} restaurants`);
    placesUrl.searchParams.set('key', apiKey);
    const placesRes = await fetch(placesUrl, { cache: 'no-store' });
    if (!placesRes.ok) throw new Error(`Google Places failed (${placesRes.status})`);
    const placesData = await placesRes.json();

    const nearbyPoints = (placesData.results ?? []).slice(0, 5).map(
      (point: { name?: string; types?: string[]; user_ratings_total?: number; rating?: number }) => ({
        name: point.name ?? 'Unknown',
        type: point.types?.[0] ?? 'place',
        rating: point.rating ?? null,
        review_count: point.user_ratings_total ?? null,
      })
    );

    const weatherAlert =
      precipProb >= 70 || rain > 0.2 ? 'Rain / precipitation risk elevated' : 'No major weather disruption detected';
    const demandImpactSignal = precipProb >= 60 ? 'delivery_up' : 'normal';
    const footTrafficSignal = nearbyPoints.length >= 3 ? 'restaurant_cluster_detected' : 'limited_density';

    return {
      source: 'live',
      city,
      weather_alert: weatherAlert,
      temperature_f: tempF,
      precipitation_probability: Math.round(precipProb),
      demand_impact_signal: demandImpactSignal,
      traffic_level: 'unknown',
      foot_traffic_signal: footTrafficSignal,
      nearby_points: nearbyPoints.length ? nearbyPoints : fallback.nearby_points,
      factors: [
        {
          domain: 'weather',
          signal: weatherAlert.toLowerCase(),
          impactWindow: 'today',
        },
        {
          domain: 'event',
          signal: footTrafficSignal === 'restaurant_cluster_detected' ? 'restaurant cluster / event density detected' : 'no major event density detected',
          impactWindow: 'this_week',
        },
        {
          domain: 'traffic',
          signal: footTrafficSignal,
          impactWindow: 'today',
        },
      ],
      warning:
        placesData.status && placesData.status !== 'OK' ? `Google Places status: ${placesData.status}` : undefined,
    };
  } catch (error) {
    return {
      ...fallback,
      source: 'fallback',
      warning: error instanceof Error ? error.message : 'Macro signals live request failed. Using fallback response.',
    };
  }
}
