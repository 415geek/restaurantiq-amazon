import { apiFetch } from '@/lib/api/client';

export function testIntegration(service: string) {
  return apiFetch<{ status: string; detail: string; timestamp: string }>(`/api/health?service=${service}`);
}

export function fetchWeatherMacro(city: string) {
  return apiFetch('/api/integrations/weather', { method: 'POST', body: JSON.stringify({ city }) });
}

export function fetchYelpReviewSignals(name: string, location: string) {
  return apiFetch('/api/integrations/yelp', { method: 'POST', body: JSON.stringify({ name, location }) });
}

export function fetchMapAreaSignals(query: string) {
  return apiFetch('/api/integrations/maps', { method: 'POST', body: JSON.stringify({ query }) });
}
