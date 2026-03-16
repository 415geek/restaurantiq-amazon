export interface SocialReview {
  id: string;
  platform: 'google' | 'yelp' | 'xiaohongshu' | 'instagram' | 'facebook';
  author: string;
  authorAvatar?: string;
  rating?: number; // 1-5
  text: string;
  date: string;
  language: 'en' | 'zh' | 'other';
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number; // -1 to 1
  keywords?: string[];
  replyText?: string;
  replyDate?: string;
  verified?: boolean;
  source_url?: string;
}

export interface SocialRadarSummary {
  platform: string;
  totalReviews: number;
  averageRating: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topKeywords: Array<{ word: string; count: number }>;
  recentTrend: 'improving' | 'stable' | 'declining';
  lastUpdated: string;
}

export interface SocialRadarConfig {
  googlePlaceId?: string;
  yelpBusinessId?: string;
  xiaohongshuKeywords?: string[];
  instagramUsername?: string;
  facebookPageId?: string;
  autoReplyEnabled?: boolean;
  alertThreshold?: number; // Rating below this triggers alert
}

