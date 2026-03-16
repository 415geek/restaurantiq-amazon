import type { SocialReview } from './types';

interface GooglePlaceDetails {
  result: {
    name: string;
    place_id: string;
    rating: number;
    user_ratings_total: number;
    reviews: Array<{
      author_name: string;
      author_url: string;
      profile_photo_url: string;
      rating: number;
      text: string;
      time: number;
      relative_time_description: string;
      language: string;
    }>;
  };
}

export class GooglePlacesClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPlaceReviews(placeId: string): Promise<SocialReview[]> {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'name,rating,user_ratings_total,reviews');
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('reviews_sort', 'newest');

    const response = await fetch(url.toString(), { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = (await response.json()) as GooglePlaceDetails;

    if (!data.result?.reviews) {
      return [];
    }

    return data.result.reviews.map((review, index) => ({
      id: `google_${placeId}_${index}_${review.time}`,
      platform: 'google' as const,
      author: review.author_name,
      authorAvatar: review.profile_photo_url,
      rating: review.rating,
      text: review.text,
      date: new Date(review.time * 1000).toISOString(),
      language: review.language === 'zh' ? 'zh' : review.language === 'en' ? 'en' : 'other',
      source_url: review.author_url,
    }));
  }

  async searchPlace(query: string, location?: string): Promise<string | null> {
    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    url.searchParams.set('input', location ? `${query} ${location}` : query);
    url.searchParams.set('inputtype', 'textquery');
    url.searchParams.set('fields', 'place_id,name,formatted_address');
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url.toString(), { cache: 'no-store' });
    const data = await response.json();

    return data.candidates?.[0]?.place_id || null;
  }
}

let googlePlacesClient: GooglePlacesClient | null = null;

export function getGooglePlacesClient(): GooglePlacesClient | null {
  if (!googlePlacesClient && process.env.GOOGLE_PLACES_API_KEY) {
    googlePlacesClient = new GooglePlacesClient(process.env.GOOGLE_PLACES_API_KEY);
  }
  return googlePlacesClient;
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

