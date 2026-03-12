import {
  socialLatestCommentsMock,
  socialMentionsMock,
  socialPlatformMetricsMock,
} from '@/lib/mock-data';
import {
  getGoogleBusinessConnectionState,
  upsertGoogleBusinessConnectionState,
} from '@/lib/server/google-business-oauth-store';
import { getMetaConnectionState } from '@/lib/server/meta-oauth-store';
import type { SocialCommentItem, SocialMentionPost, SocialPlatformMetric } from '@/lib/types';

export type SocialRadarSnapshot = {
  source: 'mock' | 'live' | 'live_partial' | 'fallback';
  configured: boolean;
  connected: { facebook: boolean; instagram: boolean };
  graphVersion: string;
  metrics: SocialPlatformMetric[];
  comments: SocialCommentItem[];
  mentions: SocialMentionPost[];
  warning?: string;
};

function sentimentFromText(text: string): SocialCommentItem['sentiment'] {
  const lower = text.toLowerCase();
  if (/(great|love|amazing|best|delicious|fast|awesome)/.test(lower)) return 'positive';
  if (/(bad|slow|cold|late|wrong|terrible|awful|issue)/.test(lower)) return 'negative';
  if (/(packaging|delay|wait|warm|okay|average|fine)/.test(lower)) return 'mixed';
  return 'neutral';
}

function buildFallbackPayload({
  configured,
  connected,
  warning,
}: {
  configured: boolean;
  connected: { facebook: boolean; instagram: boolean };
  warning: string;
}): SocialRadarSnapshot {
  const metaMetrics: SocialPlatformMetric[] = [
    {
      platform: 'instagram',
      label: 'Instagram',
      likes: 0,
      shares: 0,
      saves: 0,
      mentions: connected.instagram ? 1 : 0,
      followers_delta_pct: 0,
    },
  ];

  return {
    source: 'mock',
    configured,
    connected,
    graphVersion: process.env.META_GRAPH_VERSION || 'v25.0',
    metrics: [...socialPlatformMetricsMock, ...metaMetrics],
    comments: socialLatestCommentsMock,
    mentions: socialMentionsMock,
    warning,
  };
}

async function graphFetch<T>(
  graphVersion: string,
  path: string,
  accessToken: string,
  params?: Record<string, string>
) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, '')}`);
  url.searchParams.set('access_token', accessToken);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ||
      `Graph API request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

async function getGoogleBusinessAccessToken(userKey: string) {
  const state = getGoogleBusinessConnectionState(userKey);
  if (!state?.accessToken) return null;

  if (state.accessTokenExpiresAt && state.accessTokenExpiresAt > Date.now() + 60_000) {
    return state.accessToken;
  }

  if (!state.refreshToken) return state.accessToken;

  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return state.accessToken;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: state.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || typeof tokenData.access_token !== 'string') {
    return state.accessToken;
  }

  upsertGoogleBusinessConnectionState(userKey, {
    accessToken: tokenData.access_token,
    accessTokenExpiresAt:
      Date.now() + (typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600) * 1000,
  });

  return tokenData.access_token as string;
}

async function googleBusinessFetch<T>(url: URL | string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ||
      `Google Business request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function getSocialRadarSnapshot(userKey: string): Promise<SocialRadarSnapshot> {
  const metaConfigured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  const googleBusinessConfigured = Boolean(
    process.env.GOOGLE_BUSINESS_CLIENT_ID && process.env.GOOGLE_BUSINESS_CLIENT_SECRET
  );
  const configured = metaConfigured || googleBusinessConfigured;

  const state = getMetaConnectionState(userKey);
  const googleBusinessState = getGoogleBusinessConnectionState(userKey);
  const primaryPage = state?.pages?.[0];
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0';

  if (!configured) {
    return buildFallbackPayload({
      configured: false,
      connected: { facebook: false, instagram: false },
      warning: 'Meta and Google Business credentials are not configured. Using mock social radar payload.',
    });
  }

  const warnings: string[] = [];

  try {
    let pagePosts: Array<{
      id: string;
      message?: string;
      created_time?: string;
      permalink_url?: string;
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    }> = [];
    let facebookLiveOk = false;

    if (primaryPage?.id && primaryPage.accessToken) {
      try {
        pagePosts = (await graphFetch<{
          data?: Array<{
            id: string;
            message?: string;
            created_time?: string;
            permalink_url?: string;
            likes?: { summary?: { total_count?: number } };
            comments?: { summary?: { total_count?: number } };
            shares?: { count?: number };
          }>;
        }>(graphVersion, `${primaryPage.id}/posts`, primaryPage.accessToken, {
          fields: 'id,message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares',
          limit: '6',
        })).data ?? [];
        facebookLiveOk = true;
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : 'Failed to fetch Facebook posts');
      }
    } else if (metaConfigured) {
      warnings.push(
        'Meta OAuth is configured, but no server-side page tokens are available yet in this session. Reconnect Facebook/Instagram and try again.'
      );
    }

    const pageMetric: SocialPlatformMetric | null = primaryPage
      ? {
          platform: 'facebook',
          label: `Facebook (${primaryPage.name})`,
          likes: pagePosts.reduce((sum, post) => sum + (post.likes?.summary?.total_count ?? 0), 0),
          shares: pagePosts.reduce((sum, post) => sum + (post.shares?.count ?? 0), 0),
          saves: 0,
          mentions: pagePosts.length,
          followers_delta_pct: 0,
        }
      : null;

    const fbComments: SocialCommentItem[] = [];
    const mentionCards: SocialMentionPost[] = [];

    for (const post of pagePosts.slice(0, 3)) {
      mentionCards.push({
        id: `fb-post-${post.id}`,
        platform: 'facebook',
        author: primaryPage?.name || 'Facebook Page',
        title: (post.message || 'Facebook post').slice(0, 80),
        excerpt: (post.message || 'Facebook post').slice(0, 180),
        likes: post.likes?.summary?.total_count ?? 0,
        shares: post.shares?.count ?? 0,
        saves: 0,
        posted_at: post.created_time || new Date().toISOString(),
        url: post.permalink_url || 'https://facebook.com/',
      });

      try {
        const commentsData = (await graphFetch<{
          data?: Array<{
            id: string;
            from?: { name?: string };
            message?: string;
            created_time?: string;
            like_count?: number;
          }>;
        }>(graphVersion, `${post.id}/comments`, primaryPage?.accessToken || '', {
          fields: 'id,from,message,created_time,like_count',
          limit: '3',
        })).data ?? [];

        for (const comment of commentsData) {
          if (!comment.message) continue;
          fbComments.push({
            id: `fb-comment-${comment.id}`,
            platform: 'facebook',
            author: comment.from?.name || 'Facebook User',
            text: comment.message,
            created_at: comment.created_time || new Date().toISOString(),
            likes: comment.like_count ?? 0,
            sentiment: sentimentFromText(comment.message),
            status: 'new',
          });
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : 'Failed to fetch Facebook comments');
      }
    }

    let igMetric: SocialPlatformMetric | null = null;
    let igMentions: SocialMentionPost[] = [];
    let instagramLiveOk = false;

    if (primaryPage?.instagramBusinessAccount?.id && primaryPage.accessToken) {
      try {
        const igMedia = (await graphFetch<{
          data?: Array<{
            id: string;
            caption?: string;
            timestamp?: string;
            permalink?: string;
            like_count?: number;
            comments_count?: number;
          }>;
        }>(graphVersion, `${primaryPage.instagramBusinessAccount.id}/media`, primaryPage.accessToken, {
          fields: 'id,caption,timestamp,permalink,like_count,comments_count',
          limit: '6',
        })).data ?? [];

        igMetric = {
          platform: 'instagram',
          label: `Instagram (${primaryPage.instagramBusinessAccount.username || primaryPage.instagramBusinessAccount.name || 'Connected'})`,
          likes: igMedia.reduce((sum, media) => sum + (media.like_count ?? 0), 0),
          shares: 0,
          saves: 0,
          mentions: igMedia.length,
          reviews_count: igMedia.reduce((sum, media) => sum + (media.comments_count ?? 0), 0),
          followers_delta_pct: 0,
        };

        igMentions = igMedia.slice(0, 3).map((media) => ({
          id: `ig-media-${media.id}`,
          platform: 'instagram',
          author: `@${primaryPage.instagramBusinessAccount?.username || 'instagram'}`,
          title: (media.caption || 'Instagram post').slice(0, 80),
          excerpt: (media.caption || 'Instagram post').slice(0, 180),
          likes: media.like_count ?? 0,
          shares: 0,
          saves: 0,
          posted_at: media.timestamp || new Date().toISOString(),
          url: media.permalink || 'https://instagram.com/',
        }));
        instagramLiveOk = true;
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : 'Failed to fetch Instagram media');
      }
    } else if (primaryPage && metaConfigured) {
      warnings.push('No Instagram Professional account linked to the connected Facebook Page yet.');
    }

    const googleComments: SocialCommentItem[] = [];
    let googleMetric: SocialPlatformMetric | null = null;

    if (googleBusinessState?.accounts?.length) {
      try {
        const googleAccessToken = await getGoogleBusinessAccessToken(userKey);
        if (!googleAccessToken) {
          warnings.push('Google Business OAuth session is connected in cookie state but no access token is available.');
        } else {
          const primaryGoogleAccount = googleBusinessState.accounts[0];
          const primaryLocation = primaryGoogleAccount.locations[0];
          if (primaryLocation?.name) {
            const reviewsData = await googleBusinessFetch<{
              reviews?: Array<{
                reviewId?: string;
                reviewer?: { displayName?: string };
                comment?: string;
                createTime?: string;
                starRating?: string;
              }>;
              averageRating?: number;
              totalReviewCount?: number;
            }>(`https://mybusiness.googleapis.com/v4/${primaryLocation.name}/reviews`, googleAccessToken);

            const reviews = Array.isArray(reviewsData.reviews) ? reviewsData.reviews : [];
            googleMetric = {
              platform: 'google',
              label: primaryLocation.title ? `Google Reviews (${primaryLocation.title})` : 'Google Reviews',
              rating:
                typeof reviewsData.averageRating === 'number'
                  ? reviewsData.averageRating
                  : socialPlatformMetricsMock.find((metric) => metric.platform === 'google')?.rating,
              reviews_count:
                typeof reviewsData.totalReviewCount === 'number'
                  ? reviewsData.totalReviewCount
                  : reviews.length,
              likes: 0,
              mentions: reviews.length,
              followers_delta_pct: 0,
            };

            for (const review of reviews.slice(0, 4)) {
              if (!review.comment) continue;
              googleComments.push({
                id: `google-review-${review.reviewId || crypto.randomUUID()}`,
                platform: 'google',
                author: review.reviewer?.displayName || 'Google Reviewer',
                rating: review.starRating ? Number(String(review.starRating).replace('STAR_RATING_', '')) : undefined,
                text: review.comment,
                created_at: review.createTime || new Date().toISOString(),
                sentiment: sentimentFromText(review.comment),
                status: 'new',
              });
            }
          } else {
            warnings.push('Google Business connected, but no locations are available on the authorized account.');
          }
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : 'Failed to fetch Google Business reviews');
      }
    }

    if (!facebookLiveOk && !instagramLiveOk && !googleMetric) {
      return buildFallbackPayload({
        configured,
        connected: {
          facebook: Boolean(primaryPage),
          instagram: Boolean(primaryPage?.instagramBusinessAccount?.id),
        },
        warning: warnings.length
          ? warnings.join(' | ')
          : 'No live Facebook, Instagram, or Google Business data available. Using mock social radar payload.',
      });
    }

    const comments = [...fbComments, ...googleComments, ...socialLatestCommentsMock]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 6);

    const mentions = [...mentionCards, ...igMentions, ...socialMentionsMock].slice(0, 8);

    const metrics = [
      ...socialPlatformMetricsMock.filter(
        (metric) =>
          metric.platform !== 'instagram' &&
          metric.platform !== 'facebook' &&
          !(googleMetric && metric.platform === 'google')
      ),
      ...(igMetric ? [igMetric] : []),
      ...(googleMetric ? [googleMetric] : []),
      ...(pageMetric ? [pageMetric] : []),
    ];

    return {
      source:
        (facebookLiveOk || instagramLiveOk || Boolean(googleMetric)) &&
        ((facebookLiveOk && instagramLiveOk) || (Boolean(googleMetric) && (!metaConfigured || !primaryPage)))
          ? 'live'
          : 'live_partial',
      configured,
      connected: {
        facebook: Boolean(primaryPage),
        instagram: Boolean(primaryPage?.instagramBusinessAccount?.id),
      },
      graphVersion,
      metrics,
      comments,
      mentions,
      warning: warnings.length ? warnings.join(' | ') : undefined,
    };
  } catch (err) {
    return buildFallbackPayload({
      configured,
      connected: {
        facebook: Boolean(primaryPage),
        instagram: Boolean(primaryPage?.instagramBusinessAccount?.id),
      },
      warning: `Meta live fetch failed (${err instanceof Error ? err.message : 'unknown error'}). Using mock social radar payload.`,
    });
  }
}
