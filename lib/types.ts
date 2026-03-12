export type UrgencyLevel = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';
export type RecommendationCategory =
  | 'pricing'
  | 'marketing'
  | 'social'
  | 'operations'
  | 'inventory'
  | 'reviews'
  | 'scheduling';

export type Recommendation = {
  id: string;
  title: string;
  title_zh?: string;
  description: string;
  impact_score: number;
  urgency_level: UrgencyLevel;
  feasibility_score?: number;
  category: RecommendationCategory;
  execution_params: Record<string, unknown>;
  expected_outcome: string;
  rollback_available: boolean;
  risk_level?: RiskLevel;
  confidence?: number;
  why?: {
    finding: string;
    finding_zh: string;
    data_evidence: string;
    data_evidence_zh: string;
    benchmark: string;
    benchmark_zh: string;
  };
  impact?: {
    benefit: string;
    benefit_zh: string;
    financial: string;
    financial_zh: string;
    timeline: string;
    timeline_zh: string;
  };
  steps?: string[];
  steps_zh?: string[];
  stop_loss?: string;
  stop_loss_zh?: string;
  rollback?: string;
  rollback_zh?: string;
};

export type AgentStatus = 'connected' | 'missing' | 'error';

export type AgentSignal = {
  agent: 'A' | 'B' | 'C' | 'D';
  title: string;
  status: AgentStatus;
  summary: string;
  lastUpdatedAt: string;
};

export type AgentMetric = {
  id: string;
  title: string;
  titleEn?: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'flat';
  subtitle: string;
  tone?: 'default' | 'good' | 'warn' | 'danger';
};

export type AgentAMonthlyTrendPoint = {
  monthKey: string;
  monthLabel: string;
  monthLabelEn: string;
  orders: number;
  revenue: number;
  avgOrderValue: number;
  dailyOrders: number;
  discountRate: number;
  discountTotal: number;
  refundTotal: number;
  grossRevenue: number;
  daysWithData: number;
};

export type ExecutionStatus = 'idle' | 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back';

export type ExecutionTask = {
  taskId: string;
  recommendationId: string;
  status: ExecutionStatus;
  startedAt: number;
  rollbackDeadline?: number;
  result?: string;
  error?: string;
};

export type ExecutionLog = {
  id: string;
  recommendationTitle: string;
  status: 'completed' | 'failed' | 'rolled_back' | 'executing';
  timestamp: string;
  detail: string;
};

export type AnalysisSummary = {
  headline: string;
  insight: string;
  confidence: number;
  riskNotice?: string;
};

export type BusinessSearchCandidate = {
  id: string;
  name: string;
  address: string;
  source: 'google' | 'yelp' | 'merged' | 'mock';
  googlePlaceId?: string;
  yelpBusinessId?: string;
  rating?: number;
  reviewCount?: number;
  lat?: number;
  lng?: number;
};

export type BusinessIntelSnapshot = {
  target: {
    name: string;
    address: string;
    googlePlaceId?: string;
    yelpBusinessId?: string;
    lat?: number;
    lng?: number;
  };
  ratings: {
    google?: { rating?: number; reviewCount?: number };
    yelp?: { rating?: number; reviewCount?: number };
  };
  reviews: {
    google: Array<{ author: string; rating?: number; text: string; time?: string }>;
    yelp: Array<{ author: string; rating?: number; text: string; time?: string }>;
  };
  photos: {
    google: string[];
    yelp: string[];
  };
  area: {
    city: string;
    weather: string;
    traffic: string;
    population?: number;
    medianIncome?: number;
    businessMix: Array<{ type: string; count: number }>;
    source: 'live' | 'fallback' | 'mock';
  };
  personas: {
    mckinsey: {
      summary: string;
      keyFindings: string[];
      opportunities: string[];
      risks: string[];
    };
    gourmet: {
      summary: string;
      menuSignals: string[];
      serviceSignals: string[];
      atmosphereSignals: string[];
    };
  };
  reviewDeepDive?: {
    totalReviews: number;
    sentimentMix: {
      positive: number;
      neutral: number;
      mixed: number;
      negative: number;
    };
    topThemes: Array<{
      theme: string;
      theme_zh: string;
      evidence: string;
      evidence_zh: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  };
  competition?: {
    direct: Array<{
      name: string;
      rating?: number;
      reviewCount?: number;
      distanceKm?: number;
      source: 'google' | 'yelp' | 'merged' | 'mock';
      rationale: string;
      rationale_zh: string;
    }>;
    scenario: Array<{
      name: string;
      category: string;
      rating?: number;
      distanceKm?: number;
      source: 'google' | 'yelp' | 'merged' | 'mock';
      rationale: string;
      rationale_zh: string;
    }>;
  };
  consumerProfile?: {
    incomeBand: 'value' | 'mass' | 'premium';
    spendingPattern: string;
    spendingPattern_zh: string;
    demandWindows: string[];
    demandWindows_zh: string[];
  };
  platformIntel?: {
    source: 'nova_act' | 'api' | 'fallback';
    menuItems: Array<{
      platform: string;
      name: string;
      category?: string;
      price?: number;
      currency: string;
    }>;
    campaigns: Array<{
      platform: string;
      title: string;
      detail: string;
      status: 'active' | 'scheduled' | 'unknown';
    }>;
    warnings: string[];
  };
  comparison?: {
    baseline: {
      orders?: number;
      revenue?: number;
      aov?: number;
      discountRate?: number;
    };
    target: {
      googleRating?: number;
      yelpRating?: number;
      reviewCount?: number;
    };
    gaps: Array<{
      dimension: string;
      dimension_zh: string;
      current: string;
      benchmark: string;
      action: string;
      action_zh: string;
      priority: 'P0' | 'P1' | 'P2';
    }>;
  };
  raw: {
    google?: Record<string, unknown>;
    yelp?: Record<string, unknown>;
  };
};

export type AgentAConfidence = 'high' | 'medium' | 'low';

export type AgentAPlatformBreakdown = Record<
  string,
  {
    orders: number;
    revenue: number;
    share_pct: number;
  }
>;

export type AgentAOrderTypeBreakdown = Record<
  string,
  {
    orders: number;
    revenue: number;
    share_pct: number;
  }
>;

export type AgentAParserResult = {
  meta: {
    parser_version: string;
    restaurant_name: string;
    currency: 'USD';
    data_sources: Array<{
      filename: string;
      type: '账单明细' | '菜品汇总' | '销售汇总' | '其他';
      date_range: {
        start: string | null;
        end: string | null;
      };
      rows: number;
    }>;
    parsed_at: string;
  };
  overview: {
    total_orders: number | null;
    total_revenue: number | null;
    avg_order_value: number | null;
    daily_orders: number | null;
    discount_rate: number | null;
    total_discount: number | null;
    total_refunds: number | null;
    gross_revenue: number | null;
  };
  kpis: {
    revenue: {
      actual_total: number | null;
      gross_total: number | null;
    };
    orders: {
      total: number | null;
      days_with_data: number | null;
      per_day: number | null;
    };
    aov: {
      actual: number | null;
    };
    discounts: {
      total: number | null;
      rate: number | null;
    };
    refunds: {
      total: number | null;
      count: number | null;
      rate: number | null;
    };
    tips: {
      total: number | null;
    };
    items_sold?: {
      total: number | null;
    };
  };
  platform_breakdown: AgentAPlatformBreakdown;
  order_type_breakdown: AgentAOrderTypeBreakdown;
  monthly_trend: AgentAMonthlyTrendPoint[];
  parsing_notes: string[];
  confidence: {
    overall: AgentAConfidence;
    flags: string[];
  };
};

export type AgentBAnalysisResult = {
  analysis: {
    summary: {
      restaurant_name: string;
      period: string;
      health_score: number;
      health_grade: 'A' | 'B' | 'C' | 'D' | 'F';
      health_grade_zh: '优' | '良' | '中' | '差' | '危';
      top_issue: string;
      top_issue_zh: string;
      top_opportunity: string;
      top_opportunity_zh: string;
      data_quality: AgentAConfidence;
    };
    kpis: {
      revenue: {
        value: number;
        formatted: string;
        daily_avg: number;
        status: 'healthy' | 'warning' | 'critical';
      };
      orders: {
        value: number;
        per_day: number;
        benchmark: number;
        status: 'healthy' | 'warning' | 'critical';
        gap: number;
      };
      aov: {
        value: number;
        formatted: string;
        benchmark: number;
        status: 'healthy' | 'warning' | 'critical';
        gap: number;
      };
      discount_rate: {
        value: number;
        formatted: string;
        benchmark: number;
        status: 'healthy' | 'warning' | 'critical';
        monthly_cost: number;
      };
      refund_rate: {
        value: number;
        formatted: string;
        status: 'healthy' | 'warning' | 'critical';
      };
    };
    platform_analysis: {
      total_platforms: number;
      dominant_platform: string;
      platforms: Array<{
        name: string;
        orders: number;
        revenue: number;
        share_pct: number;
        aov: number;
        insight: string;
        insight_zh: string;
      }>;
    };
    insights: Array<{
      id: string;
      category: 'discount' | 'aov' | 'platform' | 'growth';
      priority: 'P0' | 'P1' | 'P2';
      icon: '🔴' | '🟡' | '🟢';
      finding: string;
      finding_zh: string;
      impact: string;
      impact_zh: string;
      recommendation: string;
      recommendation_zh: string;
    }>;
  };
  qa: {
    data_completeness: number;
    publish: boolean;
  };
};

export type AgentCPlanTask = {
  task_id: string;
  title: string;
  title_zh: string;
  module: 'Promotions' | 'Menu' | 'Platform' | 'Ops';
  priority: 'P0' | 'P1' | 'P2';
  status_column: 'Backlog' | 'Next 7 Days' | 'In Progress' | 'Blocked' | 'Done';
  owners: string[];
  platforms: string[];
  goal: string;
  goal_zh: string;
  why_now: string;
  why_now_zh: string;
  steps: Array<{ action: string; action_zh: string }>;
  checklist: Array<{ item: string; item_zh: string; done: boolean }>;
  timeframe_days: number;
  measurement: {
    metric: string;
    metric_zh: string;
    method: string;
    method_zh: string;
  };
  stop_loss: {
    trigger: string;
    trigger_zh: string;
    rollback: string[];
  };
  done_criteria: string[];
  done_criteria_zh: string[];
};

export type AgentCPlannerResult = {
  plan: {
    north_star: {
      objective: string;
      objective_zh: string;
      time_horizon_days: number;
      primary_metrics: string[];
      review_cadence: string;
      review_cadence_zh: string;
    };
    task_board: {
      columns: Array<'Backlog' | 'Next 7 Days' | 'In Progress' | 'Blocked' | 'Done'>;
      tasks: AgentCPlanTask[];
    };
    experiments: Array<{
      id: string;
      name: string;
      name_zh: string;
      hypothesis: string;
      hypothesis_zh: string;
      duration_days: number;
      metric: string;
      success_criteria: string;
      success_criteria_zh: string;
    }>;
    data_requests: Array<{
      id: string;
      question: string;
      question_zh: string;
      priority: 'P0' | 'P1';
      source: string;
    }>;
    assumptions: Array<{ en: string; zh: string }>;
    release_notes: {
      summary: string;
      summary_zh: string;
      internal: string;
    };
  };
};

export type FrontendReadyAnalysis = {
  display_mode: 'full' | 'summary' | 'error';
  health_badge: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    grade_zh: '优' | '良' | '中' | '差' | '危';
    color: 'green' | 'yellow' | 'orange' | 'red';
    label: string;
    label_zh: string;
  };
  kpi_cards: Array<{
    id: 'discount_rate' | 'aov' | 'orders' | 'health';
    title: string;
    title_zh: string;
    value: string;
    status: 'healthy' | 'warning' | 'critical';
    target: string;
    target_zh: string;
  }>;
  top_actions: Array<{
    rank: number;
    task_id: string;
    title: string;
    title_zh: string;
    urgency: string;
    urgency_zh: string;
    impact: string;
    impact_zh: string;
  }>;
  timeline: {
    week_1: {
      label: string;
      label_zh: string;
      tasks: string[];
    };
    week_2: {
      label: string;
      label_zh: string;
      tasks: string[];
    };
  };
  quick_stats: {
    total_tasks: number;
    p0_tasks: number;
    p1_tasks: number;
    p2_tasks: number;
    estimated_days: number;
    potential_impact: string;
    potential_impact_zh: string;
  };
  platform_summary: Array<{
    name: string;
    orders: number;
    revenue: number;
    share: string;
    aov: number;
    status: 'healthy' | 'warning' | 'critical';
  }>;
};

export type AgentDValidatorResult = {
  validated_plan: AgentCPlannerResult['plan'];
  qa_report: {
    status: 'pass' | 'pass_with_fixes' | 'incomplete' | 'fail';
    completeness_score: number;
    task_count: number;
    fixes_applied: string[];
    warnings: string[];
  };
  frontend_ready: FrontendReadyAnalysis;
};

export type AnalysisResponse = {
  summary: AnalysisSummary;
  recommendations: Recommendation[];
  agentSignals: AgentSignal[];
  source: 'mock' | 'live' | 'fallback';
  warning?: string;
  agentAParsed?: AgentAParserResult;
  agentBAnalyzed?: AgentBAnalysisResult['analysis'];
  validatedPlan?: AgentDValidatorResult['validated_plan'];
  qaReport?: AgentDValidatorResult['qa_report'];
  frontendReady?: FrontendReadyAnalysis;
  uploadedDocuments?: UploadedOpsDocument[];
  orchestration?: AnalysisOrchestrationResult;
  executionPlansPreview?: ExecutionPlanPreview[];
  businessIntel?: BusinessIntelSnapshot;
};

export type ExecuteResponse = {
  status: 'pending' | 'executing' | 'completed' | 'failed';
  task_id: string;
  rollback_deadline?: string;
  result?: string;
  error?: string;
};

export type IntegrationStatusItem = {
  key:
    | 'clerk'
    | 'openai'
    | 'ubereats'
    | 'doordash'
    | 'grubhub'
    | 'fantuan'
    | 'hungrypanda'
    | 'yelp'
    | 'yelpPartner'
    | 'googleMaps'
    | 'googleBusiness'
    | 'mapbox'
    | 'facebook'
    | 'instagram';
  label: string;
  status: AgentStatus;
  lastTestedAt?: string;
  detail: string;
};

export type RestaurantProfile = {
  name: string;
  cuisine: string;
  address: string;
  city: string;
  zip: string;
  capacity: number;
  priceBand: '$' | '$$' | '$$$';
  hours: string;
};

export type SettingsState = {
  restaurantProfile: RestaurantProfile;
  agentConfig: {
    agentAEnabled: boolean;
    agentBEnabled: boolean;
    agentCEnabled: boolean;
    refreshFrequency: '5m' | '15m' | '1h' | 'manual';
    severityThreshold: 'low' | 'medium' | 'high';
  };
  executionPolicy: {
    allowAutoExecution: boolean;
    requireSecondConfirmForHighRisk: boolean;
    rollbackWindowMinutes: 1 | 3 | 5;
    maxPriceAdjustmentPct: number;
    blacklistCategories: string;
  };
  modelRouting: {
    simpleTaskModel: string;
    analysisTaskModel: string;
    criticalDecisionModel: string;
    optimizationMode: 'cost' | 'quality';
    dailyTokenBudget: number;
  };
};

export type SubscriptionPlan = {
  plan: 'Starter' | 'Pro' | 'Agency';
  priceLabel: string;
  features: string[];
  analysisUsed: number;
  analysisLimit: number;
  executionUsed: number;
  executionLimit: number;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Manager' | 'Staff';
  status: 'active' | 'invited';
};

export type SocialPlatformMetric = {
  platform: 'facebook' | 'instagram' | 'tiktok' | 'yelp' | 'google' | 'xiaohongshu';
  label: string;
  rating?: number;
  reviews_count?: number;
  shares?: number;
  saves?: number;
  likes?: number;
  mentions?: number;
  followers_delta_pct?: number;
};

export type SocialCommentItem = {
  id: string;
  platform: SocialPlatformMetric['platform'];
  author: string;
  rating?: number;
  text: string;
  created_at: string;
  likes?: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  status: 'new' | 'replied' | 'queued';
};

export type SocialMentionPost = {
  id: string;
  platform: SocialPlatformMetric['platform'];
  author: string;
  title: string;
  excerpt: string;
  likes: number;
  saves?: number;
  shares?: number;
  posted_at: string;
  url: string;
};

export type UploadedOpsDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: 'pos' | 'delivery' | 'staffing' | 'inventory' | 'mixed' | 'unknown';
  parsingStatus: 'parsed' | 'metadata_only';
  source: 'manual_upload' | 'ubereats_api';
  extractedText: string;
  excerpt: string;
  cleaningActions?: string[];
  structuredPreview?: {
    format: 'csv' | 'tsv' | 'json' | 'text' | 'xlsx' | 'binary';
    sourceType?: 'order_details' | 'item_summary' | 'generic';
    rowCount?: number;
    columns?: string[];
    sampleValues?: Record<string, string>;
    numericMetrics?: Record<string, number>;
    canonicalMetrics?: Record<string, number>;
    businessMetrics?: {
      totalOrders?: number;
      daysWithData?: number;
      actualRevenue?: number;
      grossRevenue?: number;
      discountTotal?: number;
      tipsTotal?: number;
      refundCount?: number;
      refundAmount?: number;
      itemsSold?: number;
    };
    platformBreakdown?: Record<string, { orders: number; revenue: number }>;
    orderTypeBreakdown?: Record<string, { orders: number; revenue: number }>;
    dateStats?: {
      uniqueDays?: number;
    };
    dateRange?: { start?: string; end?: string };
    detectedKeywords?: string[];
    datasetHints?: string[];
    rowSample?: Array<Record<string, string>>;
    qualityFlags?: string[];
    parserConfidence?: number;
    inferredTimeGrain?: 'intraday' | 'daily' | 'weekly' | 'monthly' | 'unknown';
  };
  uploadedAt: string;
};

export type EvidenceRef = {
  id: string;
  sourceType:
    | 'upload'
    | 'meta'
    | 'google_business'
    | 'yelp'
    | 'weather'
    | 'news'
    | 'manual'
    | 'derived';
  sourceId: string;
  title: string;
  excerpt: string;
  freshness: string;
  confidence: number;
};

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed';

export type AnalysisRunStatus =
  | 'request_received'
  | 'planning'
  | 'ingestion_running'
  | 'normalization_done'
  | 'synthesis_running'
  | 'risk_gating'
  | 'recommendations_ready'
  | 'execution_planned'
  | 'completed'
  | 'partial_failure'
  | 'failed';

export type AgentOutput = {
  agent: 'A' | 'B' | 'C' | 'D';
  title: string;
  summary: string;
  structuredPayload: Record<string, unknown>;
  evidenceRefs: EvidenceRef[];
  confidence: number;
  warnings?: string[];
};

export type AgentRun = {
  id: string;
  runId: string;
  agent: 'planner' | 'A' | 'B' | 'C' | 'D' | 'policy' | 'execution_planner';
  status: AgentRunStatus;
  startedAt?: string;
  finishedAt?: string;
  inputSummary: string;
  outputSummary?: string;
  confidence?: number;
  warnings?: string[];
  evidenceRefs?: string[];
};

export type ExecutionPlanPreview = {
  recommendationId: string;
  requiresHumanConfirmation: boolean;
  blockedByPolicy: boolean;
  riskLevel: RiskLevel;
  rollbackAvailable: boolean;
  rollbackWindowMinutes?: number;
  actions: Array<{
    system: 'meta' | 'google_business' | 'ubereats' | 'doordash' | 'manual_task' | 'internal';
    operation: string;
    params: Record<string, unknown>;
  }>;
  reasons: string[];
};

export type AnalysisOrchestrationResult = {
  runId: string;
  status: AnalysisRunStatus;
  agentRuns: AgentRun[];
  agentOutputs: AgentOutput[];
  evidence: EvidenceRef[];
  warnings: string[];
};
