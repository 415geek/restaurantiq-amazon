import { getGooglePlacesClient, isGooglePlacesConfigured } from './google-places';
import { getYelpClient, isYelpConfigured } from './yelp';
import { analyzeReviewsBatch } from './sentiment-analyzer';
import type { SocialReview, SocialRadarSummary, SocialRadarConfig } from './types';

export class SocialRadarService {
  private config: SocialRadarConfig;

  constructor(config: SocialRadarConfig) {
    this.config = config;
  }

  async fetchAllReviews(): Promise<{
    reviews: SocialReview[];
    summaries: SocialRadarSummary[];
    errors: string[];
  }> {
    const allReviews: SocialReview[] = [];
    const summaries: SocialRadarSummary[] = [];
    const errors: string[] = [];

    // Fetch Google Reviews
    if (this.config.googlePlaceId && isGooglePlacesConfigured()) {
      try {
        const client = getGooglePlacesClient()!;
        const googleReviews = await client.getPlaceReviews(this.config.googlePlaceId);
        allReviews.push(...googleReviews);
        summaries.push(this.calculateSummary('google', googleReviews));
      } catch (error) {
        errors.push(`Google: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Fetch Yelp Reviews
    if (this.config.yelpBusinessId && isYelpConfigured()) {
      try {
        const client = getYelpClient()!;
        const yelpReviews = await client.getBusinessReviews(this.config.yelpBusinessId);
        allReviews.push(...yelpReviews);
        summaries.push(this.calculateSummary('yelp', yelpReviews));
      } catch (error) {
        errors.push(`Yelp: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Analyze sentiment for all reviews
    const analyzedReviews = await analyzeReviewsBatch(allReviews);

    return {
      reviews: analyzedReviews.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      summaries,
      errors,
    };
  }

  private calculateSummary(platform: string, reviews: SocialReview[]): SocialRadarSummary {
    const totalReviews = reviews.length;
    const ratingsSum = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = totalReviews > 0 ? ratingsSum / totalReviews : 0;

    // Count sentiments
    const sentimentBreakdown = {
      positive: reviews.filter((r) => r.sentiment === 'positive').length,
      neutral: reviews.filter((r) => r.sentiment === 'neutral').length,
      negative: reviews.filter((r) => r.sentiment === 'negative').length,
    };

    // Extract keywords
    const keywordCounts: Record<string, number> = {};
    reviews.forEach((r) => {
      r.keywords?.forEach((kw) => {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      });
    });
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    // Calculate trend (compare last 7 days vs previous 7 days)
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const inLastWeek = reviews.filter((r) => new Date(r.date).getTime() > weekAgo);
    const inPrevWeek = reviews.filter((r) => {
      const time = new Date(r.date).getTime();
      return time > twoWeeksAgo && time <= weekAgo;
    });

    const recentAvg =
      inLastWeek.reduce((sum, r) => sum + (r.rating || 0), 0) / Math.max(1, inLastWeek.length);
    const previousAvg =
      inPrevWeek.reduce((sum, r) => sum + (r.rating || 0), 0) / Math.max(1, inPrevWeek.length);

    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentAvg - previousAvg > 0.3) recentTrend = 'improving';
    else if (previousAvg - recentAvg > 0.3) recentTrend = 'declining';

    return {
      platform,
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      sentimentBreakdown,
      topKeywords,
      recentTrend,
      lastUpdated: new Date().toISOString(),
    };
  }

  async generateAlerts(): Promise<
    Array<{
      type: 'negative_review' | 'rating_drop' | 'trending_issue';
      severity: 'low' | 'medium' | 'high';
      message: string;
      review?: SocialReview;
    }>
  > {
    const { reviews } = await this.fetchAllReviews();
    const alerts: Array<{
      type: 'negative_review' | 'rating_drop' | 'trending_issue';
      severity: 'low' | 'medium' | 'high';
      message: string;
      review?: SocialReview;
    }> = [];
    const threshold = this.config.alertThreshold || 3;

    // Check for recent negative reviews
    const recentNegative = reviews
      .filter((r) => r.sentiment === 'negative' && r.rating && r.rating <= threshold)
      .slice(0, 5);

    recentNegative.forEach((review) => {
      alerts.push({
        type: 'negative_review',
        severity: review.rating === 1 ? ('high' as const) : ('medium' as const),
        message: `${review.rating}⭐ review on ${review.platform}: "${review.text.slice(0, 50)}..."`,
        review,
      });
    });

    return alerts;
  }
}

// Factory function
export function createSocialRadarService(config: SocialRadarConfig): SocialRadarService {
  return new SocialRadarService(config);
}

