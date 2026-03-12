/**
 * OpenWeather API Integration
 * Provides real-time weather data for restaurant demand forecasting
 */

export interface WeatherData {
  temperature_f: number;
  temperature_c: number;
  humidity: number;
  precipitation_probability: number;
  weather_condition: string;
  weather_alert: string;
  wind_speed_mph: number;
  visibility_miles: number;
}

export interface OpenWeatherResponse {
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  wind: {
    speed: number;
  };
  visibility: number;
  rain?: {
    '1h': number;
  };
  snow?: {
    '1h': number;
  };
}

/**
 * Fetch weather data from OpenWeather API
 * @param lat Latitude
 * @param lon Longitude
 * @param apiKey OpenWeather API key
 */
export async function fetchOpenWeatherData(
  lat: number,
  lon: number,
  apiKey: string
): Promise<WeatherData> {
  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('appid', apiKey);
  url.searchParams.set('units', 'metric'); // Use metric for easier conversion

  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`OpenWeather API failed (${response.status}): ${response.statusText}`);
  }

  const data: OpenWeatherResponse = await response.json();

  // Convert temperature to Fahrenheit
  const tempC = data.main.temp;
  const tempF = Math.round(tempC * 9 / 5 + 32);

  // Calculate precipitation probability based on weather condition
  const condition = data.weather[0]?.main?.toLowerCase() || 'clear';
  const hasPrecipitation = (data.rain?.['1h'] ?? 0) > 0 || (data.snow?.['1h'] ?? 0) > 0;
  const precipitationProbability = hasPrecipitation ? 80 : condition.includes('rain') || condition.includes('snow') ? 60 : 10;

  // Generate weather alert
  const weatherAlert = generateWeatherAlert(condition, tempF, precipitationProbability);

  return {
    temperature_f: tempF,
    temperature_c: Math.round(tempC),
    humidity: data.main.humidity,
    precipitation_probability: precipitationProbability,
    weather_condition: data.weather[0]?.description || 'Unknown',
    weather_alert: weatherAlert,
    wind_speed_mph: Math.round(data.wind.speed * 2.237), // m/s to mph
    visibility_miles: Math.round(data.visibility / 1609.34), // meters to miles
  };
}

/**
 * Generate weather alert based on conditions
 */
function generateWeatherAlert(condition: string, tempF: number, precipProb: number): string {
  const alerts: string[] = [];

  if (precipProb >= 70) {
    alerts.push('Heavy precipitation expected');
  } else if (precipProb >= 40) {
    alerts.push('Rain/snow possible');
  }

  if (tempF > 90) {
    alerts.push('Extreme heat warning');
  } else if (tempF < 32) {
    alerts.push('Freezing temperatures');
  }

  if (condition.includes('storm') || condition.includes('thunder')) {
    alerts.push('Storm conditions');
  }

  return alerts.length > 0 ? alerts.join('. ') : 'No major weather disruptions';
}

/**
 * Get weather data by city name using Google Geocoding + OpenWeather
 */
export async function getWeatherByCity(city: string, googleApiKey: string, openWeatherApiKey: string): Promise<WeatherData> {
  // First, geocode the city using Google Maps
  const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  geocodeUrl.searchParams.set('address', city);
  geocodeUrl.searchParams.set('key', googleApiKey);

  const geocodeResponse = await fetch(geocodeUrl, { cache: 'no-store' });

  if (!geocodeResponse.ok) {
    throw new Error(`Google Geocoding failed (${geocodeResponse.status})`);
  }

  const geocodeData = await geocodeResponse.json();

  if (geocodeData.status !== 'OK' || !geocodeData.results?.length) {
    throw new Error(`City not found: ${city}`);
  }

  const { lat, lng } = geocodeData.results[0].geometry.location;

  // Fetch weather data using coordinates
  return fetchOpenWeatherData(lat, lng, openWeatherApiKey);
}