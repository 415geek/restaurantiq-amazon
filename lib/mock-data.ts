import type {
  AgentMetric,
  AgentSignal,
  AnalysisResponse,
  ExecutionLog,
  IntegrationStatusItem,
  Recommendation,
  SettingsState,
  SubscriptionPlan,
  TeamMember,
  SocialPlatformMetric,
  SocialCommentItem,
  SocialMentionPost,
} from '@/lib/types';

function tomorrowLabel() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const month = tomorrow.getMonth() + 1;
  const day = tomorrow.getDate();
  return {
    zh: `${month}月${day}日`,
    en: tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

export const dashboardMetrics: AgentMetric[] = [
  { id: 'total-revenue', title: '总营收', titleEn: 'Total Revenue', value: '$197.9K', trend: '↑ +111% vs Jul', trendDirection: 'up', subtitle: '6个月累计 · 峰值 10月', tone: 'good' },
  { id: 'avg-order-value', title: '平均客单价', titleEn: 'Avg Order Value', value: '$46.58', trend: '→ 稳定', trendDirection: 'flat', subtitle: '行业基准 $50', tone: 'good' },
  { id: 'daily-orders', title: '日均订单', titleEn: 'Daily Orders', value: '30.6', trend: '↑ +63% vs Jul', trendDirection: 'up', subtitle: '10月最高 38.5', tone: 'good' },
  { id: 'discount-rate', title: '折扣率', titleEn: 'Discount Rate', value: '7.8%', trend: '✅ 健康范围', trendDirection: 'up', subtitle: '行业基准 5-8%', tone: 'good' },
];

export const agentSignals: AgentSignal[] = [
  { agent: 'A', title: 'Operations Data', status: 'connected', summary: 'Late-night labor cost climbed 14% while order volume stayed flat.', lastUpdatedAt: new Date().toISOString() },
  { agent: 'B', title: 'Social + Reviews', status: 'connected', summary: 'Review sentiment dropped on "delivery packaging" and "soup temperature".', lastUpdatedAt: new Date().toISOString() },
  { agent: 'C', title: 'Macro Factors', status: 'connected', summary: 'Heavy rain warning tomorrow likely increases delivery demand in evening window.', lastUpdatedAt: new Date().toISOString() },
];

export const recommendationsMock: Recommendation[] = [
  {
    id: 'rec-1',
    title: 'Auto-reply new Google Reviews (draft + 1-click send)',
    title_zh: '自动回复 Google 评论（AI 草拟 + 一键发送）',
    description:
      'When new Google Reviews arrive, generate an on-brand reply draft with an LLM and send it automatically after a single approval step.',
    impact_score: 9,
    urgency_level: 'high',
    feasibility_score: 8,
    category: 'reviews',
    execution_params: {
      action: 'auto_reply_google_reviews',
      platform: 'google',
      mode: 'draft_then_send',
      tone: 'friendly_professional',
    },
    expected_outcome: 'Reduce response time, improve review sentiment, and increase local conversion.',
    rollback_available: true,
    risk_level: 'medium',
    confidence: 84,
    why: {
      finding: 'A new negative review can shape buyer perception within hours.',
      finding_zh: '新的差评通常会在数小时内影响潜在顾客决策。',
      data_evidence:
        'Recent review volume is stable but response latency is inconsistent across the last 2 weeks.',
      data_evidence_zh: '近两周评论量稳定，但回复延迟波动较大。',
      benchmark:
        'Restaurants that respond within 24 hours see higher trust and improved local ranking signals.',
      benchmark_zh: '在 24 小时内回复的商家，通常能提升信任度并改善本地排名信号。',
    },
    impact: {
      benefit: 'Keep public feedback loops healthy with minimal manager time.',
      benefit_zh: '用更少的管理时间维护公开口碑反馈。',
      financial:
        'Protect rating trajectory and reduce churn from unresolved negative experiences.',
      financial_zh: '稳定评分走势，降低因负面体验未处理导致的流失。',
      timeline: 'Within 1-3 days after consistent replies.',
      timeline_zh: '持续回复后 1-3 天可看到趋势改善。',
    },
    steps: [
      'Detect new reviews (polling/webhook)',
      'Generate reply draft using LLM with brand guidelines',
      'Approve and send reply to Google Reviews',
    ],
    steps_zh: ['检测新评论（轮询/回调）', '按品牌语气用大模型生成回复草稿', '确认后一键发送回复'],
    stop_loss:
      'Switch to draft-only mode if the model produces replies that are too generic or inaccurate.',
    stop_loss_zh: '若模型回复过于模板化或信息不准确，切换为仅草拟不自动发送。',
    rollback: 'Disable auto-send and keep AI replies as drafts only.',
    rollback_zh: '关闭自动发送，仅保留 AI 草稿。',
  },
  {
    id: 'rec-2',
    title: `Raise delivery prices +10% for Super Bowl Day tomorrow (${tomorrowLabel().en}) due to rain forecast`,
    title_zh: `根据天气预报：明天（${tomorrowLabel().zh}）是 Super Bowl Day 且将下雨，建议外卖平台统一加价 10%`,
    description:
      'Rain + major sports event typically boosts delivery demand. Apply a temporary +10% delivery-channel price uplift to protect margins during the surge window.',
    impact_score: 8,
    urgency_level: 'high',
    feasibility_score: 7,
    category: 'pricing',
    execution_params: {
      action: 'bulk_delivery_markup',
      delta_pct: 10,
      channels: ['ubereats', 'doordash', 'grubhub', 'fantuan', 'hungrypanda'],
      reason: 'superbowl_rain_demand_surge',
      durationHours: 24,
    },
    expected_outcome:
      'Increase contribution margin while maintaining delivery conversion during peak demand.',
    rollback_available: true,
    risk_level: 'high',
    confidence: 76,
    why: {
      finding:
        'Weather + event-driven demand increases willingness-to-pay for delivery convenience.',
      finding_zh: '天气 + 事件驱动会提高用户为外卖便利性支付溢价的意愿。',
      data_evidence:
        'Macro signal indicates rain tomorrow; historical delivery mix rises under similar conditions.',
      data_evidence_zh: '宏观信号显示明日降雨；类似条件下历史外卖占比会上升。',
      benchmark:
        'Short, time-boxed delivery markups are safer than permanent menu price changes.',
      benchmark_zh: '限时外卖加价通常比永久性全菜单涨价更安全。',
    },
    impact: {
      benefit: 'Protect margin when demand shifts to delivery.',
      benefit_zh: '在需求向外卖倾斜时保护利润。',
      financial: 'A +10% markup can offset platform fees and weather-driven labor/packaging load.',
      financial_zh: '10% 加价可对冲平台抽成与雨天人力/打包压力。',
      timeline: 'Same day (peak window).',
      timeline_zh: '当天（高峰窗口）即可见效。',
    },
    steps: [
      'Apply +10% markup across delivery platforms',
      'Monitor conversion rate and cancellations hourly',
      'Rollback if cancellation rate spikes',
    ],
    steps_zh: ['外卖平台统一加价 10%', '按小时监控转化率与取消率', '若取消率明显上升则回滚'],
    stop_loss: 'Rollback if cancellations increase >3% absolute vs baseline.',
    stop_loss_zh: '若取消率较基线绝对值上升超过 3%，立即回滚。',
    rollback: 'Restore previous delivery prices across all affected channels.',
    rollback_zh: '恢复所有受影响外卖渠道的原价格。',
  },
  {
    id: 'rec-3',
    title: 'Flag soup packaging issue and trigger manager checklist',
    title_zh: '标记汤品包装问题并触发经理检查清单',
    description: 'Negative sentiment clustering around soup leaks. Trigger packaging QA checklist and staff reminder before dinner shift.',
    impact_score: 8,
    urgency_level: 'high',
    feasibility_score: 10,
    category: 'operations',
    execution_params: { action: 'task_broadcast', target: 'manager', checklist: 'packaging-qa-v2' },
    expected_outcome: 'Reduce complaint rate within 48 hours and protect review score.',
    rollback_available: false,
    risk_level: 'low',
    confidence: 91,
    why: {
      finding: 'Soup packaging complaints are clustering in recent reviews.',
      finding_zh: '近期评论中，汤品包装相关投诉明显聚集。',
      data_evidence: 'Negative mentions reference leaks, temperature loss, and transport damage.',
      data_evidence_zh: '负面提及集中在漏汤、温度流失和运输损坏。',
      benchmark: 'Fast intervention on repeated packaging complaints typically limits rating damage.',
      benchmark_zh: '对重复包装问题快速干预，通常能减少评分受损。'
    },
    impact: {
      benefit: 'Reduce complaints quickly and stabilize rating trajectory.',
      benefit_zh: '快速压低投诉量，稳定评分走势。',
      financial: 'Protect repeat purchase and refund exposure tied to packaging complaints.',
      financial_zh: '降低因包装投诉导致的复购流失和退款风险。',
      timeline: 'Within 24-48 hours after checklist enforcement.',
      timeline_zh: '执行检查后 24-48 小时内可见效果。'
    },
    steps: ['Send QA checklist to the manager', 'Remind pre-shift staff to inspect soup packaging', 'Track complaint frequency over the next 48 hours'],
    steps_zh: ['向经理发送 QA 检查清单', '班前提醒员工重点检查汤品包装', '未来 48 小时跟踪投诉频次'],
    stop_loss: 'Escalate to packaging supplier review if complaint volume does not drop within 48 hours.',
    stop_loss_zh: '若 48 小时内投诉量未下降，升级到供应商和包装方案复审。',
    rollback: 'Stop the temporary checklist once complaint rates normalize and SOP is updated.',
    rollback_zh: '待投诉恢复正常并完成 SOP 更新后，停止临时检查流程。'
  },
  {
    id: 'rec-4',
    title: 'Adjust staffing for Friday dinner rush',
    title_zh: '调整周五晚高峰排班',
    description: 'Forecast indicates 18% higher delivery volume. Add one prep staff and shift one cashier to pack station from 6pm-8pm.',
    impact_score: 8,
    urgency_level: 'medium',
    feasibility_score: 7,
    category: 'scheduling',
    execution_params: { action: 'schedule_shift_swap', date: 'Friday', from: 'cashier', to: 'pack_station', window: '18:00-20:00' },
    expected_outcome: 'Lower ticket delay and improve on-time delivery rate.',
    rollback_available: true,
    risk_level: 'medium',
    confidence: 82,
    why: {
      finding: 'Friday dinner demand is outpacing current staffing allocation.',
      finding_zh: '周五晚高峰需求已经超过当前排班配置。',
      data_evidence: 'Forecast shows higher delivery volume concentrated in the 18:00-20:00 window.',
      data_evidence_zh: '预测显示 18:00-20:00 外卖量明显高于常态。',
      benchmark: 'Peak-hour labor should follow order concentration, not static shift patterns.',
      benchmark_zh: '高峰时段人手应跟随订单集中度，而不是固定班次。'
    },
    impact: {
      benefit: 'Reduce queue time and packaging bottlenecks during the rush window.',
      benefit_zh: '降低排队时间和打包瓶颈。',
      financial: 'Protect throughput without expanding the full shift schedule.',
      financial_zh: '在不扩大整班排班成本的前提下保护产能。',
      timeline: 'Visible within the same service window.',
      timeline_zh: '在同一营业窗口内即可看到效果。'
    },
    steps: ['Add one prep staff for dinner prep', 'Move one cashier to packing for the 18:00-20:00 window', 'Compare ticket delay after the shift'],
    steps_zh: ['为晚高峰增加一名备餐员工', '将一名收银调至打包岗位，覆盖 18:00-20:00', '班后对比出餐延迟变化'],
    stop_loss: 'Revert if dine-in service time degrades materially after the shift swap.',
    stop_loss_zh: '如果岗位调整导致堂食服务明显变慢，则立即恢复原排班。',
    rollback: 'Restore the original staffing map after the dinner window.',
    rollback_zh: '晚高峰结束后恢复原始排班表。'
  },
  {
    id: 'rec-5',
    title: 'Temporarily increase dumpling combo price by 6%',
    title_zh: '临时上调饺子套餐价格 6%',
    description: 'Ingredient cost and demand elasticity indicate room for short-term price optimization on high-velocity combo.',
    impact_score: 6,
    urgency_level: 'low',
    feasibility_score: 6,
    category: 'pricing',
    execution_params: { action: 'update_price', sku: 'combo-dumpling-01', delta_pct: 6, channels: ['ubereats', 'doordash'] },
    expected_outcome: 'Improve margin by 2.3% on target item if demand remains stable.',
    rollback_available: true,
    risk_level: 'high',
    confidence: 64,
    why: {
      finding: 'This combo has margin pressure but still shows strong purchase velocity.',
      finding_zh: '该套餐利润承压，但销量仍保持高位。',
      data_evidence: 'Input cost and demand elasticity suggest there is room for cautious price testing.',
      data_evidence_zh: '原料成本与需求弹性显示可进行小幅价格试验。',
      benchmark: 'Small price lifts on strong bundles are safer than across-the-board menu changes.',
      benchmark_zh: '对高销量套餐做小幅提价，比全菜单调价更安全。'
    },
    impact: {
      benefit: 'Test margin upside with limited menu exposure.',
      benefit_zh: '在有限菜单暴露下测试利润空间。',
      financial: 'Potential margin lift of about 2.3% if demand stays stable.',
      financial_zh: '若需求稳定，目标商品利润率有望提升约 2.3%。',
      timeline: '7-14 days with daily elasticity monitoring.',
      timeline_zh: '连续 7-14 天监控后可判断效果。'
    },
    steps: ['Update price on target delivery channels only', 'Monitor order count and item conversion daily', 'Rollback immediately if elasticity weakens'],
    steps_zh: ['仅在目标外卖渠道更新价格', '每日监控订单量和商品转化', '若弹性走弱，立即回滚'],
    stop_loss: 'Rollback if order volume drops more than 8% within three days.',
    stop_loss_zh: '若 3 天内订单量下降超过 8%，立即回滚。',
    rollback: 'Restore the previous item price across all affected channels.',
    rollback_zh: '恢复所有受影响渠道的原始价格。'
  },
];

export const analysisSummaryMock: AnalysisResponse['summary'] = {
  headline: 'Delivery demand likely shifts upward tonight while review risk remains concentrated on packaging quality.',
  insight: 'Agent A sees demand lift, Agent B detects complaint cluster, Agent C confirms weather trigger. Best immediate action is demand capture plus QA safeguards.',
  confidence: 84,
  riskNotice: 'Price changes carry medium/high risk if applied without manager review.',
};

export const executionLogsMock: ExecutionLog[] = [
  { id: 'log-1', recommendationTitle: 'Auto-reply new Google Reviews', status: 'completed', timestamp: new Date(Date.now() - 1000 * 60 * 28).toISOString(), detail: 'Generated draft reply for 3 new reviews and queued for manager approval.' },
  { id: 'log-2', recommendationTitle: 'Raise delivery prices +10% for Super Bowl Day', status: 'rolled_back', timestamp: new Date(Date.now() - 1000 * 60 * 52).toISOString(), detail: 'Applied +10% markup then rolled back after conversion dipped.' },
  { id: 'log-3', recommendationTitle: 'Packaging QA checklist broadcast', status: 'executing', timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), detail: 'Task broadcast sent. Waiting for manager acknowledgement.' },
];

export const defaultSettings: SettingsState = {
  restaurantProfile: {
    name: 'Golden Harbor Bistro',
    cuisine: 'Cantonese',
    address: '123 Market St',
    city: 'San Francisco',
    zip: '94105',
    capacity: 58,
    priceBand: '$$',
    hours: '{"Mon-Fri":"11:00-21:30","Sat-Sun":"10:30-22:00"}',
  },
  agentConfig: {
    agentAEnabled: true,
    agentBEnabled: true,
    agentCEnabled: true,
    refreshFrequency: '15m',
    severityThreshold: 'medium',
  },
  executionPolicy: {
    allowAutoExecution: false,
    requireSecondConfirmForHighRisk: true,
    rollbackWindowMinutes: 3,
    maxPriceAdjustmentPct: 12,
    blacklistCategories: 'signature dishes, alcohol',
  },
  modelRouting: {
    simpleTaskModel: 'amazon.nova-lite-v1:0',
    analysisTaskModel: 'amazon.nova-pro-v1:0',
    criticalDecisionModel: 'amazon.nova-pro-v1:0',
    optimizationMode: 'quality',
    dailyTokenBudget: 120000,
  },
};

export const integrationStatusMock: IntegrationStatusItem[] = [
  { key: 'clerk', label: 'Clerk (Auth)', status: 'connected', lastTestedAt: new Date().toISOString(), detail: 'Authentication routes and session cookies are healthy.' },
  { key: 'openai', label: 'OpenAI (Analysis)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'OPENAI_API_KEY not configured. Running mock analysis mode.' },
  { key: 'ubereats', label: 'Uber Eats (Delivery)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'Uber Eats integration not connected yet. Click connect to authorize store access or configure a server token.' },
  { key: 'doordash', label: 'DoorDash (Delivery)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'DoorDash connection is not authorized yet. Start authorization from Integrations.' },
  { key: 'grubhub', label: 'Grubhub (Delivery)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'Grubhub connection is not authorized yet. Start authorization from Integrations.' },
  { key: 'fantuan', label: 'Fantuan (Delivery)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'Fantuan connection is not authorized yet. Start authorization from Integrations.' },
  { key: 'hungrypanda', label: 'HungryPanda (Delivery)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'HungryPanda connection is not authorized yet. Start authorization from Integrations.' },
  { key: 'facebook', label: 'Facebook (Meta Graph)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'Meta OAuth not connected yet. Click connect to authorize a Facebook Page.' },
  { key: 'instagram', label: 'Instagram (Meta Graph)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'Meta OAuth not connected yet. Connect an Instagram Professional account (via Meta).' },
  { key: 'googleBusiness', label: 'Google Business Profile', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'Google Business OAuth not connected yet. Connect a Google Business Profile account to pull ratings and reviews.' },
  { key: 'yelp', label: 'Yelp (Reviews)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'YELP_API_KEY not configured. Mock review insights enabled.' },
  { key: 'yelpPartner', label: 'Yelp Partner (Owner Account)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'Partner approval required. Public Fusion API key alone cannot connect an owner account or post replies.' },
  { key: 'googleMaps', label: 'Google Maps / Places', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'GOOGLE_MAPS_API_KEY not configured. Mock neighborhood data enabled.' },
  { key: 'mapbox', label: 'Mapbox (Map UI)', status: 'missing', lastTestedAt: new Date().toISOString(), detail: 'NEXT_PUBLIC_MAPBOX_API_KEY not configured. Map UI preview disabled.' },
];

export const mockSubscription: SubscriptionPlan = {
  plan: 'Pro',
  priceLabel: '$299/mo',
  features: ['Agent A/B/C analysis', 'Execution with rollback', 'Chinese onboarding support', '1 store included'],
  analysisUsed: 126,
  analysisLimit: 500,
  executionUsed: 41,
  executionLimit: 120,
};

export const mockTeamMembers: TeamMember[] = [
  { id: 'tm-1', name: 'Lisa Chen', email: 'lisa@goldenharbor.example', role: 'Owner', status: 'active' },
  { id: 'tm-2', name: 'David Wong', email: 'david@goldenharbor.example', role: 'Manager', status: 'active' },
  { id: 'tm-3', name: 'Kitchen Lead (Invite)', email: 'kitchen-lead@example.com', role: 'Staff', status: 'invited' },
];

export const mockAnalysisResponse: AnalysisResponse = {
  summary: analysisSummaryMock,
  recommendations: recommendationsMock,
  agentSignals,
  source: 'mock',
  agentAParsed: {
    meta: {
      parser_version: '3.0',
      restaurant_name: 'Top SF BBQ Store',
      currency: 'USD',
      data_sources: [
        {
          filename: '销售汇总表2025_06_01~2025_06_30.xlsx',
          type: '销售汇总',
          date_range: { start: '2025-06-01', end: '2025-06-30' },
          rows: 5,
        },
        {
          filename: '销售汇总表2025_07_01~2025_07_31.xlsx',
          type: '销售汇总',
          date_range: { start: '2025-07-01', end: '2025-07-31' },
          rows: 26,
        },
        {
          filename: '销售汇总表2025_08_01~2025_08_31.xlsx',
          type: '销售汇总',
          date_range: { start: '2025-08-01', end: '2025-08-31' },
          rows: 28,
        },
        {
          filename: '销售汇总表2025_09_01~2025_09_30.xlsx',
          type: '销售汇总',
          date_range: { start: '2025-09-01', end: '2025-09-30' },
          rows: 26,
        },
        {
          filename: '销售汇总表2025_10_01~2025_10_31.xlsx',
          type: '销售汇总',
          date_range: { start: '2025-10-01', end: '2025-10-31' },
          rows: 29,
        },
        {
          filename: '销售汇总表2025_11_01~2025_11_30.xlsx',
          type: '销售汇总',
          date_range: { start: '2025-11-01', end: '2025-11-30' },
          rows: 28,
        },
      ],
      parsed_at: new Date().toISOString(),
    },
    overview: {
      total_orders: 4248,
      total_revenue: 197875.54,
      avg_order_value: 46.58,
      daily_orders: 30.6,
      discount_rate: 7.8,
      total_discount: 16981.22,
      total_refunds: 3632.96,
      gross_revenue: 214856.76,
    },
    kpis: {
      revenue: { actual_total: 197875.54, gross_total: 214856.76 },
      orders: { total: 4248, days_with_data: 139, per_day: 30.6 },
      aov: { actual: 46.58 },
      discounts: { total: 16981.22, rate: 0.078 },
      refunds: { total: 3632.96, count: null, rate: null },
      tips: { total: null },
      items_sold: { total: null },
    },
    monthly_trend: [
      {
        monthKey: '2025-06',
        monthLabel: '6月',
        monthLabelEn: 'Jun',
        orders: 38,
        revenue: 386.28,
        avgOrderValue: 10.17,
        dailyOrders: 9.5,
        discountRate: 0,
        discountTotal: 0,
        refundTotal: 0,
        grossRevenue: 386.28,
        daysWithData: 4,
      },
      {
        monthKey: '2025-07',
        monthLabel: '7月',
        monthLabelEn: 'Jul',
        orders: 470,
        revenue: 21652.02,
        avgOrderValue: 46.07,
        dailyOrders: 18.8,
        discountRate: 11.5,
        discountTotal: 2852.19,
        refundTotal: 515.57,
        grossRevenue: 24504.21,
        daysWithData: 25,
      },
      {
        monthKey: '2025-08',
        monthLabel: '8月',
        monthLabelEn: 'Aug',
        orders: 836,
        revenue: 39720.64,
        avgOrderValue: 47.51,
        dailyOrders: 29.9,
        discountRate: 6.6,
        discountTotal: 2811.84,
        refundTotal: 742.86,
        grossRevenue: 42532.48,
        daysWithData: 28,
      },
      {
        monthKey: '2025-09',
        monthLabel: '9月',
        monthLabelEn: 'Sep',
        orders: 816,
        revenue: 39462.64,
        avgOrderValue: 48.36,
        dailyOrders: 31.4,
        discountRate: 6.6,
        discountTotal: 2766.39,
        refundTotal: 768.44,
        grossRevenue: 42229.03,
        daysWithData: 26,
      },
      {
        monthKey: '2025-10',
        monthLabel: '10月',
        monthLabelEn: 'Oct',
        orders: 1116,
        revenue: 51007.7,
        avgOrderValue: 45.71,
        dailyOrders: 38.5,
        discountRate: 8,
        discountTotal: 4497.41,
        refundTotal: 926.23,
        grossRevenue: 55505.11,
        daysWithData: 29,
      },
      {
        monthKey: '2025-11',
        monthLabel: '11月',
        monthLabelEn: 'Nov',
        orders: 972,
        revenue: 45646.26,
        avgOrderValue: 46.96,
        dailyOrders: 36,
        discountRate: 7.8,
        discountTotal: 4053.39,
        refundTotal: 679.86,
        grossRevenue: 49699.65,
        daysWithData: 27,
      },
    ],
    platform_breakdown: {
      'Uber Eats': {
        orders: 1912,
        revenue: 89044.0,
        share_pct: 45,
      },
      DoorDash: {
        orders: 1614,
        revenue: 75192.0,
        share_pct: 38,
      },
      熊猫外卖: {
        orders: 510,
        revenue: 23745.0,
        share_pct: 12,
      },
      饭团外卖: {
        orders: 212,
        revenue: 9894.54,
        share_pct: 5,
      },
    },
    order_type_breakdown: {
      外卖: {
        orders: 3814,
        revenue: 177875.54,
        share_pct: 89.8,
      },
      自取: {
        orders: 286,
        revenue: 12640.0,
        share_pct: 6.7,
      },
      堂食: {
        orders: 148,
        revenue: 7360.0,
        share_pct: 3.5,
      },
    },
    parsing_notes: [
      '已按销售汇总表总计行完成双向校验，核心 KPI 与月度趋势可直接用于 Dashboard。',
      '6 月数据样本量偏小，应作为冷启动月份看待，不适合单独做同比判断。',
    ],
    confidence: {
      overall: 'high',
      flags: ['sales_summary_total_row_applied'],
    },
  },
};

export const socialPlatformMetricsMock: SocialPlatformMetric[] = [
  { platform: 'instagram', label: 'Instagram', likes: 12480, shares: 312, saves: 921, mentions: 28, followers_delta_pct: 4.2 },
  { platform: 'tiktok', label: 'TikTok', likes: 18720, shares: 1104, saves: 1540, mentions: 17, followers_delta_pct: 7.9 },
  { platform: 'yelp', label: 'Yelp', rating: 4.4, reviews_count: 812, likes: 0, mentions: 0, followers_delta_pct: -0.4 },
  { platform: 'google', label: 'Google Reviews', rating: 4.5, reviews_count: 1336, likes: 0, mentions: 0, followers_delta_pct: 0.8 },
  { platform: 'xiaohongshu', label: 'Xiaohongshu', likes: 5380, shares: 206, saves: 740, mentions: 13, followers_delta_pct: 5.1 },
];

export const socialLatestCommentsMock: SocialCommentItem[] = [
  { id: 'c1', platform: 'yelp', author: 'Amy L.', rating: 3, text: 'Food was great but delivery soup arrived only warm. Packaging can improve.', created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(), likes: 2, sentiment: 'mixed', status: 'new' },
  { id: 'c2', platform: 'google', author: 'Michael Z', rating: 5, text: 'Best Cantonese roast duck in SF. Super fast service and huge portions.', created_at: new Date(Date.now() - 1000 * 60 * 44).toISOString(), likes: 5, sentiment: 'positive', status: 'new' },
  { id: 'c3', platform: 'instagram', author: '@foodiebayarea', text: 'Love the clay pot rice, but the wait time was long on Friday night.', created_at: new Date(Date.now() - 1000 * 60 * 65).toISOString(), likes: 42, sentiment: 'mixed', status: 'new' },
];

export const socialMentionsMock: SocialMentionPost[] = [
  { id: 'm1', platform: 'instagram', author: '@sf.eats', title: 'Top Chinatown comfort food picks this week', excerpt: 'Featured Golden Harbor Bistro for roast duck and congee combo. Great late-night option.', likes: 1284, saves: 392, shares: 121, posted_at: new Date(Date.now() - 1000 * 60 * 80).toISOString(), url: 'https://instagram.com/' },
  { id: 'm2', platform: 'tiktok', author: '@baybites', title: 'Rainy day noodle spots in SF', excerpt: 'Golden Harbor Bistro mentioned as a cozy pick; comments asking for delivery deals.', likes: 9421, saves: 2120, shares: 1880, posted_at: new Date(Date.now() - 1000 * 60 * 190).toISOString(), url: 'https://tiktok.com/' },
  { id: 'm3', platform: 'xiaohongshu', author: '@湾区吃货雷达', title: '旧金山中国城宵夜推荐', excerpt: '博文提到本店夜宵套餐与出餐速度，互动量较高。', likes: 316, saves: 88, shares: 24, posted_at: new Date(Date.now() - 1000 * 60 * 320).toISOString(), url: 'https://www.xiaohongshu.com/' },
];