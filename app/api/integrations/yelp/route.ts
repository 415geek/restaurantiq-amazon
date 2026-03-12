import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ name: z.string().min(1), location: z.string().min(1) });

function classifySentiment(text: string) {
  const lower = text.toLowerCase();
  const positiveWords = ['great', 'good', 'fast', 'excellent', 'love', 'amazing'];
  const negativeWords = ['bad', 'slow', 'leak', 'cold', 'late', 'poor'];
  const pos = positiveWords.some((w) => lower.includes(w));
  const neg = negativeWords.some((w) => lower.includes(w));
  if (pos && neg) return 'mixed';
  if (pos) return 'positive';
  if (neg) return 'negative';
  return 'neutral';
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Yelp request.' }, { status: 400 });

  const mockPayload = {
    source: 'mock',
    rating: 4.4,
    review_count: 812,
    latest_reviews: [
      { id: 'yr1', text: 'Great flavor but delivery soup arrived warm, not hot.', sentiment: 'mixed' },
      { id: 'yr2', text: 'Fast service and generous portions. Will order again.', sentiment: 'positive' },
      { id: 'yr3', text: 'Packaging leaked slightly during rain.', sentiment: 'negative' },
    ],
    sentiment_summary: { positive: 58, neutral: 24, negative: 18 },
  };

  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return NextResponse.json(mockPayload);

  try {
    const query = new URLSearchParams({
      term: parsed.data.name,
      location: parsed.data.location,
      limit: '1',
      sort_by: 'best_match',
    });
    const searchRes = await fetch(`https://api.yelp.com/v3/businesses/search?${query.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!searchRes.ok) throw new Error(`Yelp search failed (${searchRes.status})`);
    const searchData = await searchRes.json();
    const business = searchData.businesses?.[0];
    if (!business?.id) throw new Error('No Yelp business match found');

    let latestReviews: Array<{ id: string; text: string; sentiment: string }> = [];
    try {
      const reviewRes = await fetch(`https://api.yelp.com/v3/businesses/${business.id}/reviews`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        latestReviews = (reviewData.reviews ?? []).slice(0, 3).map((r: { id?: string; text?: string }) => ({
          id: r.id ?? `r_${Math.random().toString(36).slice(2, 8)}`,
          text: r.text ?? '',
          sentiment: classifySentiment(r.text ?? ''),
        }));
      }
    } catch {
      // Reviews are optional; still return search-based payload.
    }

    const sentimentSummary = latestReviews.reduce(
      (acc, review) => {
        const key = review.sentiment as 'positive' | 'neutral' | 'negative' | 'mixed';
        if (key === 'mixed') {
          acc.neutral += 1;
        } else {
          acc[key] += 1;
        }
        return acc;
      },
      { positive: 0, neutral: 0, negative: 0 },
    );

    return NextResponse.json({
      source: 'live',
      business_id: business.id,
      business_name: business.name,
      rating: business.rating,
      review_count: business.review_count,
      latest_reviews: latestReviews.length > 0 ? latestReviews : mockPayload.latest_reviews,
      sentiment_summary:
        latestReviews.length > 0
          ? sentimentSummary
          : mockPayload.sentiment_summary,
      warning: latestReviews.length > 0 ? undefined : 'Live Yelp reviews endpoint unavailable, showing mock review summaries.',
    });
  } catch (error) {
    return NextResponse.json({
      ...mockPayload,
      source: 'fallback',
      warning: error instanceof Error ? error.message : 'Yelp live request failed. Using mock response.',
    });
  }
}
