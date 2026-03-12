import { getMacroSignalsSnapshot } from '@/lib/server/adapters/macro-signals';
import { runNovaActMarketScan } from '@/lib/server/adapters/nova-act-market-scan';
import { buildOpsNormalizationDigest } from '@/lib/server/ops-document-parser';
import { runOpenAIJsonSchema } from '@/lib/server/openai-json';
import type {
  AnalysisResponse,
  BusinessIntelSnapshot,
  BusinessSearchCandidate,
  Recommendation,
  RecommendationCategory,
  RiskLevel,
  UploadedOpsDocument,
} from '@/lib/types';

type BusinessTargetInput = {
  name: string;
  address: string;
  googlePlaceId?: string;
  yelpBusinessId?: string;
  lat?: number;
  lng?: number;
};

type BusinessComparisonResult = NonNullable<BusinessIntelSnapshot['comparison']>;

type GooglePlaceDetails = {
  placeId?: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  lat?: number;
  lng?: number;
  reviews: Array<{ author: string; rating?: number; text: string; time?: string }>;
  photos: string[];
  raw?: Record<string, unknown>;
};

type YelpBusinessDetails = {
  businessId?: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  reviews: Array<{ author: string; rating?: number; text: string; time?: string }>;
  photos: string[];
  raw?: Record<string, unknown>;
};

type PersonaEnrichment = {
  headline: string;
  insight: string;
  confidence: number;
  mckinsey: BusinessIntelSnapshot['personas']['mckinsey'];
  gourmet: BusinessIntelSnapshot['personas']['gourmet'];
  recommendations: Array<{
    title: string;
    title_zh: string;
    description: string;
    impact_score: number;
    urgency_level: 'low' | 'medium' | 'high';
    feasibility_score: number;
    category: RecommendationCategory;
    expected_outcome: string;
    risk_level: RiskLevel;
    confidence: number;
    why: {
      finding: string;
      finding_zh: string;
      data_evidence: string;
      data_evidence_zh: string;
      benchmark: string;
      benchmark_zh: string;
    };
    impact: {
      benefit: string;
      benefit_zh: string;
      financial: string;
      financial_zh: string;
      timeline: string;
      timeline_zh: string;
    };
    steps: string[];
    steps_zh: string[];
    stop_loss: string;
    stop_loss_zh: string;
    rollback: string;
    rollback_zh: string;
  }>;
};

function safeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function avgRating(reviews: Array<{ rating?: number }>) {
  const values = reviews.map((item) => item.rating).filter((item): item is number => typeof item === 'number');
  if (!values.length) return undefined;
  return Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(2));
}

function parseYelpSentiment(reviewText: string) {
  const text = reviewText.toLowerCase();
  const positive = ['great', 'excellent', 'amazing', 'love', 'authentic', 'friendly'];
  const negative = ['slow', 'cold', 'bad', 'poor', 'late', 'bland', 'dirty'];
  const pos = positive.some((token) => text.includes(token));
  const neg = negative.some((token) => text.includes(token));
  if (pos && neg) return 'mixed';
  if (pos) return 'positive';
  if (neg) return 'negative';
  return 'neutral';
}

function buildReviewDeepDive(
  google: GooglePlaceDetails | null,
  yelp: YelpBusinessDetails | null
): NonNullable<BusinessIntelSnapshot['reviewDeepDive']> {
  const reviews = [...(google?.reviews ?? []), ...(yelp?.reviews ?? [])];
  const mix = reviews.reduce(
    (acc, row) => {
      const sentiment = parseYelpSentiment(row.text);
      if (sentiment === 'positive') acc.positive += 1;
      else if (sentiment === 'negative') acc.negative += 1;
      else if (sentiment === 'mixed') acc.mixed += 1;
      else acc.neutral += 1;
      return acc;
    },
    { positive: 0, neutral: 0, mixed: 0, negative: 0 }
  );

  const fullText = reviews.map((item) => item.text.toLowerCase()).join(' ');
  const themeCandidates: Array<{ key: string; zh: string; score: number; evidence: string; evidence_zh: string }> = [
    {
      key: 'service_speed',
      zh: '服务与出餐时效',
      score: /(slow|wait|long|late|queue|排队|慢|久)/.test(fullText) ? 3 : 1,
      evidence: 'Repeated mentions of wait time and service speed consistency.',
      evidence_zh: '评论里多次出现等待时间和服务速度相关反馈。',
    },
    {
      key: 'food_quality',
      zh: '口味与出品稳定',
      score: /(taste|flavor|bland|salty|spicy|fresh|口味|味道)/.test(fullText) ? 3 : 1,
      evidence: 'Flavor consistency and quality descriptors are high-frequency signals.',
      evidence_zh: '口味稳定性与出品质感是高频信号。',
    },
    {
      key: 'delivery_packaging',
      zh: '外卖包装与配送体验',
      score: /(packaging|leak|spill|delivery|外卖|包装|漏)/.test(fullText) ? 3 : 1,
      evidence: 'Delivery comments focus on packaging integrity and order condition.',
      evidence_zh: '外卖评论集中在包装完整性与到手状态。',
    },
    {
      key: 'value_perception',
      zh: '价格与性价比感知',
      score: /(price|value|expensive|worth|贵|划算)/.test(fullText) ? 2 : 1,
      evidence: 'Value-for-money signals indicate pricing sensitivity segments.',
      evidence_zh: '性价比反馈反映了价格敏感客群。',
    },
  ];

  const themes: NonNullable<BusinessIntelSnapshot['reviewDeepDive']>['topThemes'] = themeCandidates
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((theme, index) => ({
      theme: theme.key,
      theme_zh: theme.zh,
      evidence: theme.evidence,
      evidence_zh: theme.evidence_zh,
      priority: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
    }));

  return {
    totalReviews: reviews.length,
    sentimentMix: mix,
    topThemes: themes,
  };
}

function buildConsumerProfile(area: BusinessIntelSnapshot['area']): NonNullable<BusinessIntelSnapshot['consumerProfile']> {
  const income = area.medianIncome ?? 0;
  const incomeBand = income >= 110000 ? 'premium' : income >= 70000 ? 'mass' : 'value';
  if (incomeBand === 'premium') {
    return {
      incomeBand,
      spendingPattern: 'Premium skew: quality/storytelling and reliability matter more than deep discounting.',
      spendingPattern_zh: '高收入客群占比更高，用户更重视品质叙事与稳定体验，低价并非唯一杠杆。',
      demandWindows: ['Weekday lunch efficiency', 'Weekend dinner premium bundles', 'Rainy-day delivery'],
      demandWindows_zh: ['工作日午市效率场景', '周末晚市高客单套餐', '雨天外卖刚需场景'],
    };
  }
  if (incomeBand === 'mass') {
    return {
      incomeBand,
      spendingPattern: 'Mainstream value-focus: balanced menu architecture and smart bundles outperform pure discounting.',
      spendingPattern_zh: '主流收入带以“稳价值”为主，平衡菜单结构与组合套餐优于单纯打折。',
      demandWindows: ['Lunch combo conversion', 'Dinner family orders', 'Late-night snack demand'],
      demandWindows_zh: ['午市套餐转化窗口', '晚市家庭单窗口', '夜宵增量窗口'],
    };
  }
  return {
    incomeBand,
    spendingPattern: 'Price-sensitive segment: transparent portions, clear value combos, and controlled promo cadence are critical.',
    spendingPattern_zh: '价格敏感客群占比高，分量透明、价格明确的组合套餐和可控促销节奏最关键。',
    demandWindows: ['Value lunch slots', 'Promo-triggered peak', 'Weekend family value sets'],
    demandWindows_zh: ['高性价比午市时段', '促销触发高峰', '周末家庭性价比套餐'],
  };
}

function buildBusinessComparison(
  uploadedDocuments: UploadedOpsDocument[] | undefined,
  google: GooglePlaceDetails | null,
  yelp: YelpBusinessDetails | null
): BusinessComparisonResult | undefined {
  if (!uploadedDocuments?.length) return undefined;
  const digest = buildOpsNormalizationDigest(uploadedDocuments);
  const aggregated = digest.aggregatedMetrics;

  const baseline = {
    orders: typeof aggregated.orders === 'number' ? Number(aggregated.orders.toFixed(0)) : undefined,
    revenue: typeof aggregated.sales === 'number' ? Number(aggregated.sales.toFixed(2)) : undefined,
    aov: typeof aggregated.avg_order_value === 'number' ? Number(aggregated.avg_order_value.toFixed(2)) : undefined,
    discountRate: typeof aggregated.discount_rate === 'number' ? Number(aggregated.discount_rate.toFixed(2)) : undefined,
  };
  const target = {
    googleRating: google?.rating,
    yelpRating: yelp?.rating,
    reviewCount: (google?.reviewCount ?? 0) + (yelp?.reviewCount ?? 0),
  };

  const gaps: BusinessComparisonResult['gaps'] = [];
  if ((target.googleRating ?? 0) < 4.3 || (target.yelpRating ?? 0) < 4.2) {
    gaps.push({
      dimension: 'Review rating competitiveness',
      dimension_zh: '口碑评分竞争力',
      current: `Google ${target.googleRating ?? '-'} / Yelp ${target.yelpRating ?? '-'}`,
      benchmark: 'Google >=4.4 and Yelp >=4.3',
      action: 'Launch 14-day review-recovery sprint with issue-cluster fixes and proactive owner replies.',
      action_zh: '启动 14 天口碑修复冲刺，按问题簇整改并进行店主主动回复。',
      priority: 'P0',
    });
  }
  if ((baseline.aov ?? 0) < 42) {
    gaps.push({
      dimension: 'Average order value',
      dimension_zh: '客单价表现',
      current: baseline.aov ? `$${baseline.aov}` : 'N/A',
      benchmark: '$45+ for comparable metro segment',
      action: 'Deploy bundle ladder strategy (entry / core / premium) by daypart.',
      action_zh: '按时段上线三层组合套餐（引流 / 主力 / 高客单）提升客单。',
      priority: 'P1',
    });
  }
  if ((baseline.discountRate ?? 0) > 9) {
    gaps.push({
      dimension: 'Discount efficiency',
      dimension_zh: '折扣效率',
      current: baseline.discountRate ? `${baseline.discountRate}%` : 'N/A',
      benchmark: '6%-8% controlled discount window',
      action: 'Cut low-ROI discounts and reserve spend for weather/peak-triggered campaigns only.',
      action_zh: '减少低 ROI 折扣，仅在天气/高峰触发窗口投放促销。',
      priority: 'P0',
    });
  }
  if (!gaps.length) {
    gaps.push({
      dimension: 'Execution discipline',
      dimension_zh: '执行纪律',
      current: 'Core KPIs are broadly aligned.',
      benchmark: 'Sustain with weekly optimization cadence.',
      action: 'Run weekly menu pricing + review quality governance cycle.',
      action_zh: '保持每周菜单定价与评论质量治理节奏。',
      priority: 'P2',
    });
  }

  return { baseline, target, gaps };
}

function topCommonSignals(reviews: Array<{ text: string }>) {
  const joined = reviews.map((item) => item.text.toLowerCase()).join(' ');
  const signals: Array<{ key: string; en: string; zh: string; score: number }> = [
    { key: 'service', en: 'Service speed consistency', zh: '服务出餐速度稳定性', score: /(slow|wait|queue|line|long)/.test(joined) ? 2 : 0 },
    { key: 'taste', en: 'Flavor consistency', zh: '口味稳定性', score: /(flavor|taste|salty|sweet|bland|spicy)/.test(joined) ? 2 : 0 },
    { key: 'packaging', en: 'Delivery packaging quality', zh: '外卖包装质量', score: /(packaging|leak|spill|container)/.test(joined) ? 2 : 0 },
    { key: 'portion', en: 'Portion-value perception', zh: '分量与性价比感知', score: /(portion|value|price|expensive|worth)/.test(joined) ? 2 : 0 },
    { key: 'atmosphere', en: 'In-store dining atmosphere', zh: '堂食氛围体验', score: /(atmosphere|noise|crowd|clean)/.test(joined) ? 2 : 0 },
  ];
  return signals.filter((item) => item.score > 0).slice(0, 3);
}

async function fetchGooglePlaceDetails(target: BusinessTargetInput): Promise<GooglePlaceDetails | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  let placeId = target.googlePlaceId;
  try {
    if (!placeId) {
      const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      searchUrl.searchParams.set('query', `${target.name} ${target.address}`.trim());
      searchUrl.searchParams.set('key', apiKey);
      const searchRes = await fetch(searchUrl, { cache: 'no-store' });
      const searchData = await searchRes.json().catch(() => ({}));
      const first = Array.isArray(searchData.results) ? searchData.results[0] : null;
      if (first?.place_id) placeId = first.place_id;
    }

    if (!placeId) return null;

    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', placeId);
    detailsUrl.searchParams.set(
      'fields',
      'name,formatted_address,rating,user_ratings_total,reviews,photos,types,url,website,formatted_phone_number,business_status,geometry,opening_hours'
    );
    detailsUrl.searchParams.set('reviews_no_translations', 'false');
    detailsUrl.searchParams.set('key', apiKey);
    const detailsRes = await fetch(detailsUrl, { cache: 'no-store' });
    const detailsData = await detailsRes.json().catch(() => ({}));
    const result = detailsData?.result as Record<string, unknown> | undefined;
    if (!result) return null;

    const photos = Array.isArray(result.photos)
      ? result.photos
          .map((item) => (item && typeof item === 'object' ? (item as { photo_reference?: string }).photo_reference : undefined))
          .filter((item): item is string => Boolean(item))
          .slice(0, 3)
          .map(
            (ref) =>
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(ref)}&key=${encodeURIComponent(apiKey)}`
          )
      : [];

    const reviews = Array.isArray(result.reviews)
      ? result.reviews.slice(0, 5).map((item) => {
          const review = item as Record<string, unknown>;
          return {
            author: typeof review.author_name === 'string' ? review.author_name : 'Google User',
            rating: safeNumber(review.rating),
            text: typeof review.text === 'string' ? review.text : '',
            time: toIsoDate(review.time ? Number(review.time) * 1000 : review.time),
          };
        })
      : [];

    const geometry = result.geometry && typeof result.geometry === 'object' ? (result.geometry as Record<string, unknown>) : undefined;
    const location =
      geometry?.location && typeof geometry.location === 'object'
        ? (geometry.location as Record<string, unknown>)
        : undefined;

    return {
      placeId,
      name: typeof result.name === 'string' ? result.name : target.name,
      address: typeof result.formatted_address === 'string' ? result.formatted_address : target.address,
      rating: safeNumber(result.rating),
      reviewCount: safeNumber(result.user_ratings_total),
      lat: safeNumber(location?.lat),
      lng: safeNumber(location?.lng),
      reviews: reviews.filter((item) => item.text.trim().length > 0),
      photos,
      raw: result,
    };
  } catch {
    return null;
  }
}

async function fetchYelpBusinessDetails(target: BusinessTargetInput): Promise<YelpBusinessDetails | null> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return null;
  const headers = { Authorization: `Bearer ${apiKey}` };

  let businessId = target.yelpBusinessId;
  try {
    if (!businessId) {
      const searchUrl = new URL('https://api.yelp.com/v3/businesses/search');
      searchUrl.searchParams.set('term', target.name || 'restaurant');
      searchUrl.searchParams.set('location', target.address);
      searchUrl.searchParams.set('limit', '1');
      const searchRes = await fetch(searchUrl, { headers, cache: 'no-store' });
      const searchData = await searchRes.json().catch(() => ({}));
      const first = Array.isArray(searchData.businesses) ? searchData.businesses[0] : null;
      if (first?.id) businessId = first.id as string;
    }
    if (!businessId) return null;

    const businessRes = await fetch(`https://api.yelp.com/v3/businesses/${businessId}`, {
      headers,
      cache: 'no-store',
    });
    const business = (await businessRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!business || typeof business !== 'object') return null;

    const reviewRes = await fetch(`https://api.yelp.com/v3/businesses/${businessId}/reviews`, {
      headers,
      cache: 'no-store',
    });
    const reviewData = (await reviewRes.json().catch(() => ({}))) as Record<string, unknown>;
    const reviewRows = Array.isArray(reviewData.reviews) ? reviewData.reviews.slice(0, 5) : [];
    const reviews = reviewRows.map((item) => {
      const row = item as Record<string, unknown>;
      const user = row.user && typeof row.user === 'object' ? (row.user as Record<string, unknown>) : {};
      return {
        author: typeof user.name === 'string' ? user.name : 'Yelp User',
        rating: safeNumber(row.rating),
        text: typeof row.text === 'string' ? row.text : '',
        time: toIsoDate(row.time_created),
      };
    });

    const location = business.location && typeof business.location === 'object'
      ? (business.location as Record<string, unknown>)
      : {};
    const displayAddress = Array.isArray(location.display_address)
      ? location.display_address.filter((item): item is string => typeof item === 'string').join(', ')
      : target.address;

    return {
      businessId,
      name: typeof business.name === 'string' ? business.name : target.name,
      address: displayAddress || target.address,
      rating: safeNumber(business.rating),
      reviewCount: safeNumber(business.review_count),
      reviews: reviews.filter((item) => item.text.trim().length > 0),
      photos: Array.isArray(business.photos) ? business.photos.filter((item): item is string => typeof item === 'string').slice(0, 3) : [],
      raw: business,
    };
  } catch {
    return null;
  }
}

async function fetchCountyDemographics(lat?: number, lng?: number) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { population: undefined, medianIncome: undefined };
  }

  try {
    const fccUrl = new URL('https://geo.fcc.gov/api/census/area');
    fccUrl.searchParams.set('lat', String(lat));
    fccUrl.searchParams.set('lon', String(lng));
    fccUrl.searchParams.set('format', 'json');
    const fccRes = await fetch(fccUrl, { cache: 'no-store' });
    const fccData = await fccRes.json().catch(() => ({}));
    const blockFips = Array.isArray(fccData?.results) ? fccData.results[0]?.block_fips : undefined;
    if (typeof blockFips !== 'string' || blockFips.length < 5) {
      return { population: undefined, medianIncome: undefined };
    }
    const state = blockFips.slice(0, 2);
    const county = blockFips.slice(2, 5);

    const censusUrl = new URL('https://api.census.gov/data/2023/acs/acs5');
    censusUrl.searchParams.set('get', 'B01003_001E,B19013_001E');
    censusUrl.searchParams.set('for', `county:${county}`);
    censusUrl.searchParams.set('in', `state:${state}`);
    const censusRes = await fetch(censusUrl, { cache: 'no-store' });
    const censusData = await censusRes.json().catch(() => []);
    if (!Array.isArray(censusData) || censusData.length < 2 || !Array.isArray(censusData[1])) {
      return { population: undefined, medianIncome: undefined };
    }
    const row = censusData[1] as Array<string | number>;
    const population = Number(row[0]);
    const medianIncome = Number(row[1]);
    return {
      population: Number.isFinite(population) ? population : undefined,
      medianIncome: Number.isFinite(medianIncome) ? medianIncome : undefined,
    };
  } catch {
    return { population: undefined, medianIncome: undefined };
  }
}

async function fetchBusinessMix(lat?: number, lng?: number) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || typeof lat !== 'number' || typeof lng !== 'number') return [];
  try {
    const nearby = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    nearby.searchParams.set('location', `${lat},${lng}`);
    nearby.searchParams.set('radius', '1500');
    nearby.searchParams.set('type', 'restaurant');
    nearby.searchParams.set('key', apiKey);
    const res = await fetch(nearby, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data.results) ? data.results : [];
    const counter = new Map<string, number>();
    for (const row of rows.slice(0, 30)) {
      const types = Array.isArray((row as { types?: unknown }).types) ? ((row as { types?: unknown[] }).types ?? []) : [];
      const type = types.find((item): item is string => typeof item === 'string' && item !== 'restaurant') || 'restaurant';
      counter.set(type, (counter.get(type) ?? 0) + 1);
    }
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  } catch {
    return [];
  }
}

function buildDeterministicPersona(
  target: BusinessTargetInput,
  google: GooglePlaceDetails | null,
  yelp: YelpBusinessDetails | null,
  area: BusinessIntelSnapshot['area']
) {
  const allReviews = [...(google?.reviews ?? []), ...(yelp?.reviews ?? [])];
  const positive = allReviews.filter((item) => parseYelpSentiment(item.text) === 'positive').length;
  const negative = allReviews.filter((item) => parseYelpSentiment(item.text) === 'negative').length;
  const mixed = allReviews.length - positive - negative;
  const averageScore = Number(
    (
      ((google?.rating ?? avgRating(google?.reviews ?? []) ?? 0) + (yelp?.rating ?? avgRating(yelp?.reviews ?? []) ?? 0)) /
      ((google?.rating ? 1 : 0) + (yelp?.rating ? 1 : 0) || 1)
    ).toFixed(2)
  );
  const signals = topCommonSignals(allReviews.map((item) => ({ text: item.text })));

  const mckinsey: BusinessIntelSnapshot['personas']['mckinsey'] = {
    summary: `在 ${target.address} 周边，该门店评分均值约 ${averageScore}/5，评论中正向 ${positive} 条、负向 ${negative} 条。建议优先处理“${signals[0]?.zh ?? '服务与稳定性'}”问题，并利用高评分资产提升复购。`,
    keyFindings: [
      `Google 评分：${google?.rating ?? 'N/A'}（${google?.reviewCount ?? 0} 条）`,
      `Yelp 评分：${yelp?.rating ?? 'N/A'}（${yelp?.reviewCount ?? 0} 条）`,
      `区域交通信号：${area.traffic}，天气信号：${area.weather}`,
    ],
    opportunities: [
      '把高频好评关键词提炼成菜单与广告文案',
      '围绕晚高峰与天气场景做平台定向活动',
      '对负向评论集中点建立 SOP 闭环',
    ],
    risks: [
      mixed > positive ? '评论口碑分化，如果不处理会拖慢转化。' : '口碑整体稳定，但需防止热门品出餐波动。',
      area.traffic === 'high' ? '高交通强度可能影响履约时效。' : '交通风险当前可控。',
    ],
  };

  const gourmet: BusinessIntelSnapshot['personas']['gourmet'] = {
    summary: `从食客视角，这家店的核心吸引力在于“${signals[0]?.zh ?? '招牌风味'}”。建议把“好评菜品 + 场景化搭配”做成内容主线，同时强化服务细节与摆盘一致性。`,
    menuSignals: [
      '围绕高提及菜品建立主副菜搭配套餐',
      '将顾客高频词汇转为菜单描述语言',
      '每月迭代 1-2 个季节限定口味，持续制造新鲜感',
    ],
    serviceSignals: [
      '高峰期设置出餐时长承诺并在评价中主动回访',
      '对负面评论提供可执行补偿策略',
      '把评论中的“慢/冷/漏”问题映射到岗位检查项',
    ],
    atmosphereSignals: [
      '加强门店视觉一致性，提升打卡分享意愿',
      '将热门菜品拍摄成统一风格素材用于社媒',
      '把门店故事和食材来源融入内容发布节奏',
    ],
  };

  const recommendations: Recommendation[] = [
    {
      id: 'BI-R1',
      title: 'Optimize high-visibility review issues across Google & Yelp',
      title_zh: '优先修复 Google / Yelp 高可见度差评问题',
      description: 'Cluster negative review themes and launch a 14-day service + product quality remediation sprint.',
      impact_score: 9,
      urgency_level: 'high',
      feasibility_score: 8,
      category: 'reviews',
      execution_params: { owner: 'ops_manager', channel: ['google', 'yelp'], window_days: 14 },
      expected_outcome: 'Lift conversion trust and improve review trajectory within 2-4 weeks.',
      rollback_available: true,
      risk_level: 'medium',
      confidence: 86,
      why: {
        finding: 'Negative and mixed reviews highlight recurring service and consistency issues.',
        finding_zh: '负向与混合评论反复提到服务与稳定性问题。',
        data_evidence: `Collected ${allReviews.length} recent reviews across Google and Yelp with sentiment mix P:${positive} / N:${negative} / M:${mixed}.`,
        data_evidence_zh: `跨 Google/Yelp 共采集 ${allReviews.length} 条最新评论，情绪分布为正向 ${positive}、负向 ${negative}、混合 ${mixed}。`,
        benchmark: 'Top local competitors keep negative review ratio under ~15%.',
        benchmark_zh: '本地高表现门店通常将负评占比控制在约 15% 以下。',
      },
      impact: {
        benefit: 'Reduce visible review friction and raise intent-to-order conversion.',
        benefit_zh: '降低公开口碑阻力，提升下单转化意愿。',
        financial: 'Expected revenue uplift from improved conversion and repeat rate.',
        financial_zh: '通过转化与复购提升带来营收增量。',
        timeline: '2-4 weeks',
        timeline_zh: '2-4 周',
      },
      steps: [
        'Tag top 3 recurring complaint clusters',
        'Assign corrective owner per cluster',
        'Reply to legacy reviews with clear action updates',
        'Track week-over-week sentiment shift',
      ],
      steps_zh: [
        '标记前三类高频投诉问题',
        '为每类问题指定整改负责人',
        '对历史评论进行带动作说明的回复',
        '按周追踪情绪变化',
      ],
      stop_loss: 'If average rating drops for 2 consecutive weeks, pause campaign expansion.',
      stop_loss_zh: '若平均评分连续 2 周下降，暂停扩展动作并复盘。',
      rollback: 'Revert to baseline reply and promotion cadence while auditing operations.',
      rollback_zh: '回退至基线回复与促销节奏，同时进行运营审计。',
    },
    {
      id: 'BI-R2',
      title: 'Build a location-aware demand playbook',
      title_zh: '建立基于地理与天气的需求运营手册',
      description: 'Use weather, traffic, and business-mix signals to trigger channel-specific promotions and staffing shifts.',
      impact_score: 8,
      urgency_level: 'medium',
      feasibility_score: 7,
      category: 'operations',
      execution_params: { owner: 'store_manager', trigger: ['weather', 'traffic', 'peak_window'] },
      expected_outcome: 'Improve demand capture efficiency and reduce missed peak opportunities.',
      rollback_available: true,
      risk_level: 'low',
      confidence: 82,
      why: {
        finding: 'Local demand windows vary with weather and traffic patterns.',
        finding_zh: '本地需求窗口明显受天气与交通波动影响。',
        data_evidence: `Current macro signals: weather=${area.weather}, traffic=${area.traffic}.`,
        data_evidence_zh: `当前宏观信号：天气=${area.weather}，交通=${area.traffic}。`,
        benchmark: 'Top operators align campaign timing with local external signals.',
        benchmark_zh: '高表现门店会把营销和排班与外部信号联动。',
      },
      impact: {
        benefit: 'Capture more demand during high-intent windows.',
        benefit_zh: '在高意图时段捕获更多需求。',
        financial: 'Higher promo ROI and lower wasted discount spend.',
        financial_zh: '提升促销 ROI，减少无效折扣支出。',
        timeline: '1-2 weeks',
        timeline_zh: '1-2 周',
      },
      steps: ['Define weather/traffic trigger thresholds', 'Map triggers to promo templates', 'Adjust staffing by trigger table'],
      steps_zh: ['定义天气/交通触发阈值', '建立触发阈值对应的促销模板', '按触发表调整排班'],
      stop_loss: 'If daily orders drop >15% for 3 days, revert trigger thresholds.',
      stop_loss_zh: '若日单量连续 3 天下降超 15%，回退触发阈值。',
      rollback: 'Restore previous promotion and staffing schedule.',
      rollback_zh: '恢复上一版促销与排班策略。',
    },
  ];

  return {
    headline: `${target.name} · 综合口碑与商圈分析`,
    insight: `${mckinsey.summary} ${gourmet.summary}`,
    confidence: 0.84,
    mckinsey,
    gourmet,
    recommendations,
  };
}

async function maybeEnrichWithOpenAI(input: {
  target: BusinessTargetInput;
  google: GooglePlaceDetails | null;
  yelp: YelpBusinessDetails | null;
  area: BusinessIntelSnapshot['area'];
  deterministic: ReturnType<typeof buildDeterministicPersona>;
}): Promise<PersonaEnrichment | null> {
  return runOpenAIJsonSchema<PersonaEnrichment>({
    model: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-5-mini',
    temperature: 0.2,
    maxOutputTokens: 2600,
    prompt: [
      'You are RestaurantIQ multi-agent synthesis output.',
      'Act simultaneously as:',
      '1) A local McKinsey-style restaurant business analyst.',
      '2) A world-class gourmet critic focused on culinary and dining experience signals.',
      'Use provided Google/Yelp review + photo context + area signals to produce a practical report and executable recommendations.',
      'Be specific, avoid generic advice, keep bilingual recommendation fields.',
      JSON.stringify({
        target: input.target,
        google: input.google,
        yelp: input.yelp,
        area: input.area,
        deterministicBaseline: input.deterministic,
      }),
    ].join('\n'),
    schemaName: 'business_intel_persona_analysis',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'insight', 'confidence', 'mckinsey', 'gourmet', 'recommendations'],
      properties: {
        headline: { type: 'string' },
        insight: { type: 'string' },
        confidence: { type: 'number' },
        mckinsey: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'keyFindings', 'opportunities', 'risks'],
          properties: {
            summary: { type: 'string' },
            keyFindings: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
            opportunities: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
            risks: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
          },
        },
        gourmet: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'menuSignals', 'serviceSignals', 'atmosphereSignals'],
          properties: {
            summary: { type: 'string' },
            menuSignals: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
            serviceSignals: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
            atmosphereSignals: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
          },
        },
        recommendations: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'title',
              'title_zh',
              'description',
              'impact_score',
              'urgency_level',
              'feasibility_score',
              'category',
              'expected_outcome',
              'risk_level',
              'confidence',
              'why',
              'impact',
              'steps',
              'steps_zh',
              'stop_loss',
              'stop_loss_zh',
              'rollback',
              'rollback_zh',
            ],
            properties: {
              title: { type: 'string' },
              title_zh: { type: 'string' },
              description: { type: 'string' },
              impact_score: { type: 'number', minimum: 1, maximum: 10 },
              urgency_level: { type: 'string', enum: ['low', 'medium', 'high'] },
              feasibility_score: { type: 'number', minimum: 1, maximum: 10 },
              category: {
                type: 'string',
                enum: ['pricing', 'marketing', 'social', 'operations', 'inventory', 'reviews', 'scheduling'],
              },
              expected_outcome: { type: 'string' },
              risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
              confidence: { type: 'number', minimum: 0, maximum: 100 },
              why: {
                type: 'object',
                additionalProperties: false,
                required: ['finding', 'finding_zh', 'data_evidence', 'data_evidence_zh', 'benchmark', 'benchmark_zh'],
                properties: {
                  finding: { type: 'string' },
                  finding_zh: { type: 'string' },
                  data_evidence: { type: 'string' },
                  data_evidence_zh: { type: 'string' },
                  benchmark: { type: 'string' },
                  benchmark_zh: { type: 'string' },
                },
              },
              impact: {
                type: 'object',
                additionalProperties: false,
                required: ['benefit', 'benefit_zh', 'financial', 'financial_zh', 'timeline', 'timeline_zh'],
                properties: {
                  benefit: { type: 'string' },
                  benefit_zh: { type: 'string' },
                  financial: { type: 'string' },
                  financial_zh: { type: 'string' },
                  timeline: { type: 'string' },
                  timeline_zh: { type: 'string' },
                },
              },
              steps: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 8 },
              steps_zh: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 8 },
              stop_loss: { type: 'string' },
              stop_loss_zh: { type: 'string' },
              rollback: { type: 'string' },
              rollback_zh: { type: 'string' },
            },
          },
        },
      },
    },
  });
}

function mapSignals(source: AnalysisResponse['source']) {
  return [
    {
      agent: 'A' as const,
      title: 'Agent A · Review & media ingestion',
      status: source === 'fallback' ? ('missing' as const) : ('connected' as const),
      summary: source === 'fallback' ? 'Using partial external data with fallback normalization.' : 'Collected Google/Yelp reviews, ratings, and media assets.',
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      agent: 'B' as const,
      title: 'Agent B · Deep review analytics',
      status: 'connected' as const,
      summary: 'Extracted sentiment, issue clusters, and opportunity patterns from cross-platform reviews.',
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      agent: 'C' as const,
      title: 'Agent C · Market context intelligence',
      status: 'connected' as const,
      summary: 'Merged weather, traffic, demographic, and business-mix context into the analysis baseline.',
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      agent: 'D' as const,
      title: 'Agent D · Dual-persona strategic synthesis',
      status: 'connected' as const,
      summary: 'Generated McKinsey-style business diagnosis and gourmet-level product/service recommendations.',
      lastUpdatedAt: new Date().toISOString(),
    },
  ];
}

export async function runBusinessIntelAnalysis(input: {
  target: BusinessTargetInput;
  sortBy?: 'composite' | 'impact' | 'urgency';
  uploadedDocuments?: UploadedOpsDocument[];
  compareMode?: boolean;
}): Promise<AnalysisResponse> {
  const google = await fetchGooglePlaceDetails(input.target);
  const yelp = await fetchYelpBusinessDetails(input.target);
  const lat = google?.lat ?? input.target.lat;
  const lng = google?.lng ?? input.target.lng;
  const city = (google?.address || input.target.address).split(',')[1]?.trim() || 'San Francisco';
  const [macro, demographics, businessMix, competitorSearch, platformIntel] = await Promise.all([
    getMacroSignalsSnapshot(city),
    fetchCountyDemographics(lat, lng),
    fetchBusinessMix(lat, lng),
    searchBusinessCandidatesByAddress(input.target.address),
    runNovaActMarketScan({
      businessName: input.target.name,
      city,
    }),
  ]);

  const area: BusinessIntelSnapshot['area'] = {
    city,
    weather: `${macro.weather_alert} · ${macro.temperature_f}°F`,
    traffic: macro.traffic_level,
    population: demographics.population,
    medianIncome: demographics.medianIncome,
    businessMix,
    source: macro.source,
  };

  const deterministic = buildDeterministicPersona(input.target, google, yelp, area);
  const reviewDeepDive = buildReviewDeepDive(google, yelp);
  const consumerProfile = buildConsumerProfile(area);
  const comparison = input.compareMode ? buildBusinessComparison(input.uploadedDocuments, google, yelp) : undefined;

  const directCompetition = competitorSearch.candidates
    .filter((candidate) => candidate.name.toLowerCase() !== (google?.name || input.target.name).toLowerCase())
    .slice(0, 4)
    .map((candidate) => ({
      name: candidate.name,
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
      source: candidate.source,
      rationale: 'Overlaps in cuisine intent and same delivery demand pool around target address.',
      rationale_zh: '在目标地址周边与本店争夺同一餐饮需求与外卖流量池。',
    })) satisfies NonNullable<BusinessIntelSnapshot['competition']>['direct'];

  const scenarioCompetition = businessMix.slice(0, 3).map((item) => ({
    name: `${item.type} cluster`,
    category: item.type,
    source: 'mock' as const,
    rationale: 'Competes for the same meal occasion and wallet share in this micro-market.',
    rationale_zh: '在该微商圈争夺相同用餐场景与钱包份额。',
  })) satisfies NonNullable<BusinessIntelSnapshot['competition']>['scenario'];

  const enriched = await maybeEnrichWithOpenAI({
    target: input.target,
    google,
    yelp,
    area,
    deterministic,
  });
  const persona = enriched ?? deterministic;

  const recommendations = (persona.recommendations ?? deterministic.recommendations).map((item, index) => ({
    id: `BI-${index + 1}`,
    title: item.title,
    title_zh: item.title_zh,
    description: item.description,
    impact_score: item.impact_score,
    urgency_level: item.urgency_level,
    feasibility_score: item.feasibility_score,
    category: item.category,
    execution_params: {
      channel: ['google', 'yelp'],
      rank: index + 1,
      basedOn: 'business_intel',
      target: {
        name: input.target.name,
        address: input.target.address,
      },
    },
    expected_outcome: item.expected_outcome,
    rollback_available: true,
    risk_level: item.risk_level,
    confidence: item.confidence,
    why: item.why,
    impact: item.impact,
    steps: item.steps,
    steps_zh: item.steps_zh,
    stop_loss: item.stop_loss,
    stop_loss_zh: item.stop_loss_zh,
    rollback: item.rollback,
    rollback_zh: item.rollback_zh,
  })) satisfies Recommendation[];

  const sortBy = input.sortBy ?? 'composite';
  const urgencyRank = { high: 3, medium: 2, low: 1 } as const;
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    if (sortBy === 'impact') return b.impact_score - a.impact_score;
    if (sortBy === 'urgency') return urgencyRank[b.urgency_level] - urgencyRank[a.urgency_level];
    const scoreA = a.impact_score * 0.5 + (a.feasibility_score ?? 6) * 0.2 + urgencyRank[a.urgency_level] * 1.4 + (a.confidence ?? 75) / 50;
    const scoreB = b.impact_score * 0.5 + (b.feasibility_score ?? 6) * 0.2 + urgencyRank[b.urgency_level] * 1.4 + (b.confidence ?? 75) / 50;
    return scoreB - scoreA;
  });

  const intel: BusinessIntelSnapshot = {
    target: {
      name: google?.name || yelp?.name || input.target.name,
      address: google?.address || yelp?.address || input.target.address,
      googlePlaceId: google?.placeId || input.target.googlePlaceId,
      yelpBusinessId: yelp?.businessId || input.target.yelpBusinessId,
      lat,
      lng,
    },
    ratings: {
      google: google ? { rating: google.rating, reviewCount: google.reviewCount } : undefined,
      yelp: yelp ? { rating: yelp.rating, reviewCount: yelp.reviewCount } : undefined,
    },
    reviews: {
      google: google?.reviews ?? [],
      yelp: yelp?.reviews ?? [],
    },
    photos: {
      google: google?.photos ?? [],
      yelp: yelp?.photos ?? [],
    },
    area,
    reviewDeepDive,
    consumerProfile,
    competition: {
      direct: directCompetition,
      scenario: scenarioCompetition,
    },
    platformIntel: {
      source: platformIntel.source,
      menuItems: platformIntel.menuItems,
      campaigns: platformIntel.campaigns,
      warnings: platformIntel.warnings,
    },
    comparison,
    personas: {
      mckinsey: persona.mckinsey,
      gourmet: persona.gourmet,
    },
    raw: {
      google: google?.raw,
      yelp: yelp?.raw,
    },
  };

  const hasLive = Boolean(google || yelp);
  const source: AnalysisResponse['source'] = hasLive ? 'live' : 'fallback';
  const confidenceRaw = typeof persona.confidence === 'number' ? persona.confidence : 0.82;
  const confidenceNormalized = confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw;

  return {
    summary: {
      headline: persona.headline,
      insight: persona.insight,
      confidence: Math.max(0.5, Math.min(0.98, confidenceNormalized)),
      riskNotice: hasLive
        ? undefined
        : 'Google/Yelp live data is partially unavailable. Current report includes fallback context.',
    },
    recommendations: sortedRecommendations,
    agentSignals: mapSignals(source),
    source,
    warning: [
      hasLive
        ? undefined
        : 'Live external adapters returned partial data. Showing fallback-enriched output.',
      competitorSearch.warning,
      ...(platformIntel.warnings ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      || undefined,
    businessIntel: intel,
  };
}

export async function searchBusinessCandidatesByAddress(address: string): Promise<{
  source: 'mock' | 'live' | 'fallback';
  candidates: BusinessSearchCandidate[];
  warning?: string;
}> {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const yelpKey = process.env.YELP_API_KEY;
  const warnings: string[] = [];
  const candidates: BusinessSearchCandidate[] = [];

  if (mapsKey) {
    try {
      const googleUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      googleUrl.searchParams.set('query', `restaurants near ${address}`);
      googleUrl.searchParams.set('key', mapsKey);
      const res = await fetch(googleUrl, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const rows = Array.isArray(data.results) ? data.results.slice(0, 6) : [];
      for (const row of rows) {
        const item = row as Record<string, unknown>;
        const geometry = item.geometry && typeof item.geometry === 'object' ? (item.geometry as Record<string, unknown>) : undefined;
        const location =
          geometry?.location && typeof geometry.location === 'object'
            ? (geometry.location as Record<string, unknown>)
            : undefined;
        candidates.push({
          id: `google:${String(item.place_id ?? crypto.randomUUID())}`,
          source: 'google',
          name: typeof item.name === 'string' ? item.name : 'Unknown',
          address: typeof item.formatted_address === 'string' ? item.formatted_address : address,
          googlePlaceId: typeof item.place_id === 'string' ? item.place_id : undefined,
          rating: safeNumber(item.rating),
          reviewCount: safeNumber(item.user_ratings_total),
          lat: safeNumber(location?.lat),
          lng: safeNumber(location?.lng),
        });
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Google business search failed');
    }
  }

  if (yelpKey) {
    try {
      const yelpUrl = new URL('https://api.yelp.com/v3/businesses/search');
      yelpUrl.searchParams.set('term', 'restaurant');
      yelpUrl.searchParams.set('location', address);
      yelpUrl.searchParams.set('limit', '6');
      const res = await fetch(yelpUrl, {
        headers: { Authorization: `Bearer ${yelpKey}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      const rows = Array.isArray(data.businesses) ? data.businesses.slice(0, 6) : [];
      for (const row of rows) {
        const item = row as Record<string, unknown>;
        const location = item.location && typeof item.location === 'object'
          ? (item.location as Record<string, unknown>)
          : {};
        const coords = item.coordinates && typeof item.coordinates === 'object'
          ? (item.coordinates as Record<string, unknown>)
          : {};
        const displayAddress = Array.isArray(location.display_address)
          ? location.display_address.filter((entry): entry is string => typeof entry === 'string').join(', ')
          : address;
        candidates.push({
          id: `yelp:${String(item.id ?? crypto.randomUUID())}`,
          source: 'yelp',
          name: typeof item.name === 'string' ? item.name : 'Unknown',
          address: displayAddress || address,
          yelpBusinessId: typeof item.id === 'string' ? item.id : undefined,
          rating: safeNumber(item.rating),
          reviewCount: safeNumber(item.review_count),
          lat: safeNumber(coords.latitude),
          lng: safeNumber(coords.longitude),
        });
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Yelp business search failed');
    }
  }

  if (!candidates.length) {
    return {
      source: 'mock',
      candidates: [
        {
          id: 'mock:1',
          source: 'mock',
          name: 'Golden Harbor Bistro',
          address,
          rating: 4.4,
          reviewCount: 812,
          lat: 37.794,
          lng: -122.407,
        },
        {
          id: 'mock:2',
          source: 'mock',
          name: 'Canton Night Grill',
          address,
          rating: 4.2,
          reviewCount: 531,
          lat: 37.793,
          lng: -122.409,
        },
      ],
      warning:
        warnings[0] ||
        'No live Google/Yelp candidate available. Showing mock businesses.',
    };
  }

  const dedup = new Map<string, BusinessSearchCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.name.toLowerCase()}|${candidate.address.toLowerCase()}`;
    const existing = dedup.get(key);
    if (!existing) {
      dedup.set(key, candidate);
      continue;
    }
    dedup.set(key, {
      ...existing,
      source: 'merged',
      googlePlaceId: existing.googlePlaceId || candidate.googlePlaceId,
      yelpBusinessId: existing.yelpBusinessId || candidate.yelpBusinessId,
      rating: existing.rating ?? candidate.rating,
      reviewCount: existing.reviewCount ?? candidate.reviewCount,
      lat: existing.lat ?? candidate.lat,
      lng: existing.lng ?? candidate.lng,
    });
  }

  return {
    source: warnings.length ? 'fallback' : 'live',
    candidates: [...dedup.values()].slice(0, 10),
    warning: warnings[0],
  };
}
