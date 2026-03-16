import type { SocialReview } from './types';

interface YelpBusiness {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  url: string;
}

interface YelpReview {
  id: string;
  rating: number;
  text: string;
  time_created: string;
  user: {
    name: string;
    image_url: string;
  };
}

export class YelpClient {
  private apiKey: string;
  private baseUrl = 'https://api.yelp.com/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(path: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Yelp API error: ${response.status}`);
    }

    return response.json();
  }

  async searchBusiness(name: string, location: string): Promise<YelpBusiness | null> {
    const params = new URLSearchParams({
      term: name,
      location,
      categories: 'restaurants',
      limit: '1',
    });

    const data = await this.makeRequest(`/businesses/search?${params.toString()}`);
    return data.businesses?.[0] || null;
  }

  async getBusinessReviews(businessId: string): Promise<SocialReview[]> {
    const data = await this.makeRequest(`/businesses/${businessId}/reviews?limit=50&sort_by=newest`);

    return (data.reviews || []).map((review: YelpReview) => ({
      id: `yelp_${review.id}`,
      platform: 'yelp' as const,
      author: review.user.name,
      authorAvatar: review.user.image_url,
      rating: review.rating,
      text: review.text,
      date: review.time_created,
      language: 'en' as const, // Yelp is primarily English
    }));
  }

  async getBusinessDetails(businessId: string): Promise<YelpBusiness> {
    return this.makeRequest(`/businesses/${businessId}`);
  }
}

let yelpClient: YelpClient | null = null;

export function getYelpClient(): YelpClient | null {
  if (!yelpClient && process.env.YELP_API_KEY) {
    yelpClient = new YelpClient(process.env.YELP_API_KEY);
  }
  return yelpClient;
}

export function isYelpConfigured(): boolean {
  return Boolean(process.env.YELP_API_KEY);
}

