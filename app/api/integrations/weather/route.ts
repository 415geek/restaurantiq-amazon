import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getMacroSignalsSnapshot } from '@/lib/server/adapters/macro-signals';

const schema = z.object({ city: z.string().min(1).default('San Francisco') });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { city } = schema.parse(body);
  const snapshot = await getMacroSignalsSnapshot(city);

  return NextResponse.json({
    provider:
      snapshot.source === 'live'
        ? 'google-geocode + openweather + google-places'
        : process.env.GOOGLE_MAPS_API_KEY && process.env.OPENWEATHER_API_KEY
          ? 'configured-server-provider'
          : 'mock',
    city: snapshot.city,
    weather_alert: snapshot.weather_alert,
    temperature_f: snapshot.temperature_f,
    precipitation_probability: snapshot.precipitation_probability,
    demand_impact_signal: snapshot.demand_impact_signal,
    traffic_level: snapshot.traffic_level,
    foot_traffic_signal: snapshot.foot_traffic_signal,
    nearby_points: snapshot.nearby_points,
    source: snapshot.source,
    warning: snapshot.warning,
  });
}