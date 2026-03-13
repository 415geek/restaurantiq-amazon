import type { UploadedOpsDocument } from '@/lib/types';

function nowIso() {
  return new Date().toISOString();
}

export function buildDemoMockOpsDocuments(): UploadedOpsDocument[] {
  const uploadedAt = nowIso();

  const pos: UploadedOpsDocument = {
    id: 'demo-pos-30d',
    fileName: 'demo_pos_last_30_days.csv',
    mimeType: 'text/csv',
    size: 48_120,
    category: 'pos',
    parsingStatus: 'parsed',
    source: 'manual_upload',
    extractedText: [
      'POS Summary (mock data, last 30 days)',
      '- Total revenue: $197,900',
      '- Total orders: 4,380',
      '- Avg order value: $45.18',
      '- Discount rate: 7.8%',
      '- Top items: BBQ Platter, Dumpling Combo, Hainan Chicken Rice',
      '- Peak hours: 12:00-13:30, 18:00-20:30',
    ].join('\n'),
    excerpt: 'Mock POS summary for the last 30 days (revenue, orders, AOV, discount).',
    structuredPreview: {
      format: 'csv',
      sourceType: 'generic',
      rowCount: 1200,
      columns: ['date', 'orders', 'revenue', 'discount', 'avg_order_value'],
      businessMetrics: {
        totalOrders: 4380,
        daysWithData: 30,
        actualRevenue: 197900,
        grossRevenue: 214800,
        discountTotal: 16700,
        refundCount: 42,
        refundAmount: 980,
      },
      dateRange: { start: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10), end: uploadedAt.slice(0, 10) },
      inferredTimeGrain: 'daily',
      parserConfidence: 0.92,
      qualityFlags: ['mock_dataset'],
      detectedKeywords: ['pos', 'orders', 'revenue', 'aov'],
    },
    uploadedAt,
  };

  const delivery: UploadedOpsDocument = {
    id: 'demo-delivery-30d',
    fileName: 'demo_delivery_platforms_last_30_days.json',
    mimeType: 'application/json',
    size: 62_540,
    category: 'delivery',
    parsingStatus: 'parsed',
    source: 'manual_upload',
    extractedText: [
      'Delivery Platforms Summary (mock data, last 30 days)',
      '- Uber Eats: 1,820 orders, $92,600 revenue',
      '- DoorDash: 1,160 orders, $52,900 revenue',
      '- Grubhub: 610 orders, $26,700 revenue',
      '- Top issue tags: packaging, soup temperature, wait time',
      '- Avg prep time: 17 mins',
    ].join('\n'),
    excerpt: 'Mock delivery platform summary by channel (orders, revenue, prep time).',
    structuredPreview: {
      format: 'json',
      sourceType: 'order_details',
      rowCount: 3590,
      businessMetrics: {
        totalOrders: 3590,
        daysWithData: 30,
        actualRevenue: 172200,
        grossRevenue: 188900,
        discountTotal: 12400,
        refundCount: 58,
        refundAmount: 1540,
      },
      platformBreakdown: {
        ubereats: { orders: 1820, revenue: 92600 },
        doordash: { orders: 1160, revenue: 52900 },
        grubhub: { orders: 610, revenue: 26700 },
      },
      inferredTimeGrain: 'daily',
      parserConfidence: 0.9,
      qualityFlags: ['mock_dataset'],
      detectedKeywords: ['delivery', 'ubereats', 'doordash', 'grubhub'],
    },
    uploadedAt,
  };

  return [delivery, pos];
}
