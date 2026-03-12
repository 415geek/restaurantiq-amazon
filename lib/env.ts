const parseBool = (value: string | undefined, fallback = false) => {
  if (value == null) return fallback;
  return value === 'true';
};

export const appEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Restaurant IQ',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  agentStudioHost: process.env.NEXT_PUBLIC_AGENT_TUNE_HOST || 'agenttune.restaurantiq.ai',
  useMockData: parseBool(process.env.NEXT_PUBLIC_USE_MOCK_DATA, true),
  clerkConfigured: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
};

export const integrationEnvStatus = {
  clerk: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY),
  openai: Boolean(process.env.OPENAI_API_KEY),
  awsNova: Boolean(process.env.AWS_NOVA_API_KEY),
  openweather: Boolean(process.env.OPENWEATHER_API_KEY),
  ubereats: Boolean(
    (process.env.UBEREATS_CLIENT_ID && process.env.UBEREATS_CLIENT_SECRET)
      || process.env.UBEREATS_BEARER_TOKEN
  ),
  yelp: Boolean(process.env.YELP_API_KEY),
  yelpPartner: Boolean(process.env.YELP_CLIENT_ID && process.env.YELP_CLIENT_SECRET),
  googleMaps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
  googleBusiness: Boolean(
    process.env.GOOGLE_BUSINESS_CLIENT_ID && process.env.GOOGLE_BUSINESS_CLIENT_SECRET
  ),
  mapbox: Boolean(process.env.NEXT_PUBLIC_MAPBOX_API_KEY),
  facebook: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
  instagram: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
};