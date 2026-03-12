import { getWeatherByCity } from './weather-openweather';

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

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

  if (!googleApiKey || !openWeatherApiKey) {
    return {
      ...fallback,
      source: 'fallback',
      warning: 'GOOGLE_MAPS_API_KEY and OPENWEATHER_API_KEY required for live data',
    };
  }

  try {
    // Get weather data using OpenWeather API
    const weatherData = await getWeatherByCity(city, googleApiKey, openWeatherApiKey);

    // Get nearby places using Google Places
    const placesUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    placesUrl.searchParams.set('query', `${city} restaurants`);
    placesUrl.searchParams.set('key', googleApiKey);
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

    const demandImpactSignal = weatherData.precipitation_probability >= 60 ? 'delivery_up' : 'normal';
    const footTrafficSignal = nearbyPoints.length >= 3 ? 'restaurant_cluster_detected' : 'limited_density';

    return {
      source: 'live',
      city,
      weather_alert: weatherData.weather_alert,
      temperature_f: weatherData.temperature_f,
      precipitation_probability: weatherData.precipitation_probability,
      demand_impact_signal: demandImpactSignal,
      traffic_level: 'unknown',
      foot_traffic_signal: footTrafficSignal,
      nearby_points: nearbyPoints.length ? nearbyPoints : fallback.nearby_points,
      factors: [
        {
          domain: 'weather',
          signal: weatherData.weather_alert.toLowerCase(),
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