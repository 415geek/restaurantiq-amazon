import { generateNovaCompletion } from '@/lib/server/aws-nova-client';
import type { SocialReview } from './types';

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number; // -1 to 1
  keywords: string[];
  summary: string;
}

const SENTIMENT_PROMPT = `Analyze the sentiment of this restaurant review. Return JSON only:
{
  "sentiment": "positive" | "neutral" | "negative",
  "score": number between -1 (very negative) and 1 (very positive),
  "keywords": ["keyword1", "keyword2", ...] (max 5 key topics mentioned),
  "summary": "one sentence summary in same language as review"
}

Review text:
`;

export async function analyzeSentiment(review: SocialReview): Promise<SentimentResult> {
  try {
    const response = await generateNovaCompletion(SENTIMENT_PROMPT + review.text, {
      model: 'amazon.nova-lite-v1:0',
      temperature: 0.1,
      maxTokens: 300,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    return JSON.parse(jsonMatch[0]) as SentimentResult;
  } catch {
    // Fallback: simple keyword-based sentiment
    const text = review.text.toLowerCase();
    const positiveWords = ['great', 'excellent', 'amazing', 'delicious', 'best', 'love', '好吃', '推荐', '满意'];
    const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'never', 'disappointed', '难吃', '差', '不推荐'];

    let score = 0;
    positiveWords.forEach((word) => {
      if (text.includes(word)) score += 0.2;
    });
    negativeWords.forEach((word) => {
      if (text.includes(word)) score -= 0.2;
    });
    score = Math.max(-1, Math.min(1, score));

    return {
      sentiment: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
      score,
      keywords: [],
      summary: review.text.slice(0, 100),
    };
  }
}

export async function analyzeReviewsBatch(reviews: SocialReview[]): Promise<SocialReview[]> {
  const analyzed = await Promise.all(
    reviews.map(async (review) => {
      const sentiment = await analyzeSentiment(review);
      return {
        ...review,
        sentiment: sentiment.sentiment,
        sentimentScore: sentiment.score,
        keywords: sentiment.keywords,
      };
    })
  );
  return analyzed;
}

