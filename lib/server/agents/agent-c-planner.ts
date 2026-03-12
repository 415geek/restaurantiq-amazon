import type { AgentCPlannerResult, AgentOutput, AgentBAnalysisResult } from '@/lib/types';
import { runOpenAIJsonSchema } from '@/lib/server/openai-json';

const TASK_COLUMNS = ['Backlog', 'Next 7 Days', 'In Progress', 'Blocked', 'Done'] as const;

function uniquePlatforms(analyzed: AgentBAnalysisResult['analysis']) {
  const names = analyzed.platform_analysis.platforms.map((platform) => platform.name).filter(Boolean);
  return names.length ? names : ['all_channels'];
}

function dominantPlatform(analyzed: AgentBAnalysisResult['analysis']) {
  return analyzed.platform_analysis.dominant_platform || analyzed.platform_analysis.platforms[0]?.name || 'primary channel';
}

function buildDefaultTasks(analyzed: AgentBAnalysisResult['analysis']): AgentCPlannerResult['plan']['task_board']['tasks'] {
  const platform = dominantPlatform(analyzed);
  const allPlatforms = uniquePlatforms(analyzed);
  const discountRate = analyzed.kpis.discount_rate.formatted;
  const aov = analyzed.kpis.aov.formatted;
  const ordersPerDay = analyzed.kpis.orders.per_day;

  return [
    {
      task_id: 'T-001',
      title: `Audit active discount rules on ${platform}`,
      title_zh: `审核 ${platform} 当前折扣规则`,
      module: 'Promotions',
      priority: 'P0',
      status_column: 'Next 7 Days',
      owners: ['manager'],
      platforms: [platform],
      goal: `Bring discount rate below 20% from the current ${discountRate}.`,
      goal_zh: `将折扣率从当前 ${discountRate} 压到 20% 以下。`,
      why_now: 'Discount pressure is the clearest margin leak in the uploaded data.',
      why_now_zh: '折扣压力是上传数据中最明确的利润泄漏点。',
      steps: [
        { action: 'Export all platform promo rules and remove overlapping offers.', action_zh: '导出所有平台促销规则，先移除重叠优惠。' },
        { action: 'Keep only one hero promo per platform during the next 7 days.', action_zh: '未来 7 天每个平台仅保留一个主推促销。' },
      ],
      checklist: [
        { item: 'List active discount rules', item_zh: '列出当前启用的折扣规则', done: false },
        { item: 'Turn off low-conversion promos', item_zh: '关闭低转化促销', done: false },
      ],
      timeframe_days: 3,
      measurement: {
        metric: 'Discount rate',
        metric_zh: '折扣率',
        method: 'Compare net discount cost before and after promo cleanup.',
        method_zh: '比较促销清理前后的净折扣成本。',
      },
      stop_loss: {
        trigger: 'Order conversion drops more than 8% for two consecutive days.',
        trigger_zh: '若连续 2 天订单转化率下降超过 8%。',
        rollback: ['Restore the highest-performing promo rule.', 'Rollback promo schedule to previous state.'],
      },
      done_criteria: ['Discount rate is at or below 20%.', 'No major order-volume drop after cleanup.'],
      done_criteria_zh: ['折扣率降到 20% 或以下。', '清理后订单量没有明显下滑。'],
    },
    {
      task_id: 'T-002',
      title: `Optimize ${platform} merchandising and ranking`,
      title_zh: `优化 ${platform} 的陈列与排序`,
      module: 'Platform',
      priority: 'P0',
      status_column: 'Next 7 Days',
      owners: ['manager'],
      platforms: [platform],
      goal: 'Improve the dominant platform conversion without adding discount cost.',
      goal_zh: '在不增加折扣成本的前提下提升主平台转化率。',
      why_now: `${platform} is the main revenue source and should be optimized first.`,
      why_now_zh: `${platform} 是当前主收入来源，应优先优化。`,
      steps: [
        { action: 'Refresh hero images and move top-selling bundles to the first scroll.', action_zh: '更新主图，并将高销量套餐放到首屏。' },
        { action: 'Highlight the most reliable delivery dishes with clear labels.', action_zh: '为履约稳定的菜品增加明确标签。' },
      ],
      checklist: [
        { item: 'Refresh platform hero assets', item_zh: '更新平台主视觉素材', done: false },
        { item: 'Pin top-selling combos', item_zh: '置顶高销量套餐', done: false },
      ],
      timeframe_days: 4,
      measurement: {
        metric: 'Platform orders',
        metric_zh: '平台订单量',
        method: 'Track order count and conversion on the dominant platform.',
        method_zh: '跟踪主平台的订单量和转化表现。',
      },
      stop_loss: {
        trigger: 'Platform revenue drops for 3 straight days after changes.',
        trigger_zh: '调整后主平台营收连续 3 天下滑。',
        rollback: ['Restore previous menu ordering.', 'Revert hero creative assets.'],
      },
      done_criteria: ['Dominant platform orders improve versus baseline.', 'No increase in refund complaints.'],
      done_criteria_zh: ['主平台订单量高于基线。', '退款投诉没有上升。'],
    },
    {
      task_id: 'T-003',
      title: 'Create one bundle anchored to best-selling items',
      title_zh: '基于热销菜品创建一个套餐',
      module: 'Menu',
      priority: 'P1',
      status_column: 'Next 7 Days',
      owners: ['manager'],
      platforms: allPlatforms,
      goal: `Lift AOV above the current ${aov}.`,
      goal_zh: `把客单价从当前 ${aov} 往上拉。`,
      why_now: 'Bundle design is the fastest lever to improve basket size.',
      why_now_zh: '套餐设计是提升客单价最快的杠杆。',
      steps: [
        { action: 'Select two top-selling mains and one high-margin add-on.', action_zh: '挑选两款热销主菜和一个高毛利加购项。' },
        { action: 'Price the bundle at a visible but margin-safe discount.', action_zh: '将套餐定价设为用户可感知但毛利安全的折扣。' },
      ],
      checklist: [
        { item: 'Choose items with stable prep time', item_zh: '选择出餐时间稳定的菜品', done: false },
        { item: 'Confirm target margin before publish', item_zh: '上线前确认目标毛利', done: false },
      ],
      timeframe_days: 5,
      measurement: {
        metric: 'Bundle attach rate',
        metric_zh: '套餐采用率',
        method: 'Track bundle orders and blended AOV versus baseline.',
        method_zh: '跟踪套餐订单占比以及与基线相比的综合客单价。',
      },
      stop_loss: {
        trigger: 'Bundle margin falls below acceptable floor.',
        trigger_zh: '套餐毛利低于可接受下限。',
        rollback: ['Pause bundle listing.', 'Revert to item-level merchandising.'],
      },
      done_criteria: ['Bundle launched on at least one major platform.', 'Bundle AOV exceeds store baseline.'],
      done_criteria_zh: ['至少在一个主平台上线套餐。', '套餐客单价高于门店基线。'],
    },
    {
      task_id: 'T-004',
      title: 'Push high-AOV channels with targeted messaging',
      title_zh: '针对高客单价渠道做定向推动',
      module: 'Platform',
      priority: 'P1',
      status_column: 'Next 7 Days',
      owners: ['manager'],
      platforms: analyzed.platform_analysis.platforms.slice(0, 2).map((item) => item.name),
      goal: 'Shift more demand toward channels with stronger basket size.',
      goal_zh: '把更多需求转移到客单价更高的渠道。',
      why_now: 'Channel mix can improve unit economics without changing the full menu.',
      why_now_zh: '优化渠道结构可以在不大改菜单的情况下改善单位经济模型。',
      steps: [
        { action: 'Tag the highest-AOV channel in internal reporting and marketing copy.', action_zh: '在内部报表和营销文案中标记高客单价渠道。' },
        { action: 'Allocate promo placements toward that channel for 7 days.', action_zh: '未来 7 天将促销资源向该渠道倾斜。' },
      ],
      checklist: [
        { item: 'Identify top AOV channel', item_zh: '识别最高客单价渠道', done: false },
        { item: 'Shift promo inventory', item_zh: '调整促销资源分配', done: false },
      ],
      timeframe_days: 7,
      measurement: {
        metric: 'Channel AOV and share',
        metric_zh: '渠道客单价与占比',
        method: 'Compare channel-level AOV and order share after reallocation.',
        method_zh: '比较调整后渠道客单价与订单占比变化。',
      },
      stop_loss: {
        trigger: 'Other major channels lose more than 10% order share.',
        trigger_zh: '其他主要渠道订单占比下降超过 10%。',
        rollback: ['Restore previous promo placements.'],
      },
      done_criteria: ['Higher-AOV channels gain share.', 'Blended AOV improves.'],
      done_criteria_zh: ['高客单价渠道占比提升。', '整体客单价提升。'],
    },
    {
      task_id: 'T-005',
      title: 'Optimize low-performing menu items',
      title_zh: '优化低表现菜品',
      module: 'Menu',
      priority: 'P1',
      status_column: 'Backlog',
      owners: ['manager'],
      platforms: allPlatforms,
      goal: 'Reduce menu complexity and concentrate demand on strong sellers.',
      goal_zh: '减少菜单复杂度，把需求集中到强势菜品上。',
      why_now: 'Menu complexity often hides low-margin items and weak conversion paths.',
      why_now_zh: '菜单复杂度常常掩盖低毛利菜品和弱转化路径。',
      steps: [
        { action: 'Review low-volume items by platform once item-level sales data is available.', action_zh: '补齐菜品级数据后，按平台复盘低销量菜品。' },
        { action: 'Retire or rename weak listings that dilute choice architecture.', action_zh: '下架或重命名会稀释选择路径的弱表现菜品。' },
      ],
      checklist: [
        { item: 'Collect item-level sales cut', item_zh: '收集菜品级销售拆分', done: false },
        { item: 'Mark bottom performers', item_zh: '标记低表现菜品', done: false },
      ],
      timeframe_days: 10,
      measurement: {
        metric: 'Menu item conversion',
        metric_zh: '菜品转化率',
        method: 'Track sell-through of retained versus retired items.',
        method_zh: '跟踪保留菜品与调整菜品的售出表现。',
      },
      stop_loss: {
        trigger: 'High-visibility menu changes trigger negative feedback spikes.',
        trigger_zh: '大幅菜单改动引发负面反馈上升。',
        rollback: ['Restore removed items.', 'Reinstate previous naming and visuals.'],
      },
      done_criteria: ['Bottom-decile items are identified.', 'At least one cleanup action is executed.'],
      done_criteria_zh: ['识别出底部 10% 菜品。', '至少执行一项菜单清理动作。'],
    },
    {
      task_id: 'T-006',
      title: 'Set up add-on and upsell paths',
      title_zh: '建立加购与 upsell 路径',
      module: 'Menu',
      priority: 'P1',
      status_column: 'Backlog',
      owners: ['manager'],
      platforms: allPlatforms,
      goal: 'Increase basket size with low-friction add-ons.',
      goal_zh: '通过低阻力加购提高购物篮金额。',
      why_now: 'Add-ons improve AOV without relying only on discounting.',
      why_now_zh: '加购能在不依赖折扣的情况下提升客单价。',
      steps: [
        { action: 'Select one beverage and one side as universal add-ons.', action_zh: '选择一款饮品和一款小食作为通用加购。' },
        { action: 'Place add-ons at checkout and bundle surfaces.', action_zh: '在结账页和套餐位展示加购项。' },
      ],
      checklist: [
        { item: 'Choose high-margin add-ons', item_zh: '选择高毛利加购项', done: false },
        { item: 'Enable checkout upsell placements', item_zh: '开启结账页 upsell 展示位', done: false },
      ],
      timeframe_days: 7,
      measurement: {
        metric: 'Add-on attach rate',
        metric_zh: '加购采用率',
        method: 'Track checkout attachment and blended AOV lift.',
        method_zh: '跟踪加购采用率及带来的综合客单价提升。',
      },
      stop_loss: {
        trigger: 'Checkout conversion drops after upsell insertion.',
        trigger_zh: '加入 upsell 后结账转化率下滑。',
        rollback: ['Remove upsell placements from checkout.'],
      },
      done_criteria: ['At least two add-ons are live.', 'Attach rate is measurable in reporting.'],
      done_criteria_zh: ['至少上线两项加购。', '报表中能追踪加购采用率。'],
    },
    {
      task_id: 'T-007',
      title: 'Run quality and operations check on refund drivers',
      title_zh: '围绕退款驱动做品质与运营检查',
      module: 'Ops',
      priority: 'P2',
      status_column: 'Backlog',
      owners: ['manager'],
      platforms: allPlatforms,
      goal: 'Reduce preventable refunds and service failures.',
      goal_zh: '降低可避免的退款和履约问题。',
      why_now: 'Refund signals suggest at least some quality or fulfillment issues need root-cause review.',
      why_now_zh: '退款信号说明至少存在部分品质或履约问题，需要追根溯源。',
      steps: [
        { action: 'Review recent refund cases by channel and menu item.', action_zh: '按渠道和菜品复盘近期退款案例。' },
        { action: 'Add one pre-shift quality check on the highest-risk category.', action_zh: '针对高风险品类增加一项班前品质检查。' },
      ],
      checklist: [
        { item: 'Summarize refund reasons', item_zh: '汇总退款原因', done: false },
        { item: 'Assign quality owner', item_zh: '指定品质责任人', done: false },
      ],
      timeframe_days: 7,
      measurement: {
        metric: 'Refund rate',
        metric_zh: '退款率',
        method: 'Track refund count and amount after quality actions.',
        method_zh: '跟踪执行品质动作后的退款单量与金额。',
      },
      stop_loss: {
        trigger: 'Refund rate worsens after operational changes.',
        trigger_zh: '执行运营调整后退款率继续恶化。',
        rollback: ['Revert process change.', 'Escalate to manual manager review.'],
      },
      done_criteria: ['Top refund causes are documented.', 'One mitigation action is active.'],
      done_criteria_zh: ['主要退款原因已被归档。', '至少一项修复动作已执行。'],
    },
    {
      task_id: 'T-008',
      title: 'Close the data tracking gaps that block optimization',
      title_zh: '补齐阻碍优化的数据追踪缺口',
      module: 'Ops',
      priority: 'P2',
      status_column: 'Backlog',
      owners: ['manager'],
      platforms: allPlatforms,
      goal: 'Make weekly optimization decisions from complete platform and item-level data.',
      goal_zh: '让周度优化决策可以基于完整的平台和菜品级数据。',
      why_now: 'Several optimization decisions still rely on partial data.',
      why_now_zh: '当前有多项优化决策仍然依赖不完整数据。',
      steps: [
        { action: 'Define one shared export format for platform, item, ratings, and delivery-time data.', action_zh: '统一平台、菜品、评分和配送时长数据的导出格式。' },
        { action: 'Schedule a weekly upload and review routine inside RestaurantIQ.', action_zh: '在 RestaurantIQ 内建立每周上传与复盘节奏。' },
      ],
      checklist: [
        { item: 'Standardize weekly export template', item_zh: '标准化周度导出模板', done: false },
        { item: 'Assign weekly data owner', item_zh: '指定每周数据负责人', done: false },
      ],
      timeframe_days: 14,
      measurement: {
        metric: 'Data completeness',
        metric_zh: '数据完整度',
        method: 'Measure the percentage of required data requests fulfilled weekly.',
        method_zh: '每周统计关键数据请求的完成率。',
      },
      stop_loss: {
        trigger: 'Data collection process creates excessive operational overhead.',
        trigger_zh: '数据收集流程造成过高的运营负担。',
        rollback: ['Reduce collection scope to P0/P1 items first.'],
      },
      done_criteria: ['Weekly export routine is assigned.', 'Core missing datasets are scheduled.'],
      done_criteria_zh: ['周度导出节奏已明确负责人。', '关键缺失数据已进入计划。'],
    },
  ];
}

function buildDefaultExperiments(analyzed: AgentBAnalysisResult['analysis']): AgentCPlannerResult['plan']['experiments'] {
  const platform = dominantPlatform(analyzed);
  return [
    {
      id: 'E-001',
      name: 'Discount reduction test',
      name_zh: '折扣下调测试',
      hypothesis: 'Reducing broad discount coverage will protect margin without materially hurting order conversion.',
      hypothesis_zh: '下调大范围折扣覆盖率，可以在不明显伤害转化的前提下保护利润。',
      duration_days: 7,
      metric: 'Discount rate and conversion',
      success_criteria: 'Discount cost drops with stable or improved orders.',
      success_criteria_zh: '折扣成本下降，同时订单量保持稳定或提升。',
    },
    {
      id: 'E-002',
      name: 'Bundle conversion test',
      name_zh: '套餐转化测试',
      hypothesis: 'A targeted bundle will increase AOV more efficiently than blanket discounts.',
      hypothesis_zh: '定向套餐比普遍降价更能有效提升客单价。',
      duration_days: 7,
      metric: 'Bundle attach rate and AOV',
      success_criteria: 'Bundle orders lift blended AOV above baseline.',
      success_criteria_zh: '套餐订单带动整体客单价高于基线。',
    },
    {
      id: 'E-003',
      name: `${platform} pricing test`,
      name_zh: `${platform} 定价测试`,
      hypothesis: `Platform-specific pricing on ${platform} can improve contribution margin without triggering refund risk.`,
      hypothesis_zh: `在 ${platform} 做平台定向定价，有机会提升贡献利润且不引发退款风险。`,
      duration_days: 7,
      metric: 'Platform AOV and margin',
      success_criteria: 'Platform margin improves and refund rate stays within normal range.',
      success_criteria_zh: '平台利润率提升，且退款率维持在正常范围内。',
    },
  ];
}

function buildDefaultDataRequests(): AgentCPlannerResult['plan']['data_requests'] {
  return [
    {
      id: 'D-001',
      question: 'What is the promo breakdown by platform for the last 14 days?',
      question_zh: '过去 14 天各平台促销拆分情况是什么？',
      priority: 'P0',
      source: 'Platform exports',
    },
    {
      id: 'D-002',
      question: 'Which items drive sales by platform and by order type?',
      question_zh: '各平台、各就餐方式的销量核心菜品分别是什么？',
      priority: 'P0',
      source: 'Item summary exports',
    },
    {
      id: 'D-003',
      question: 'How are customer ratings trending by platform?',
      question_zh: '各平台顾客评分趋势如何？',
      priority: 'P1',
      source: 'Yelp / Google / platform reviews',
    },
    {
      id: 'D-004',
      question: 'What are the current delivery time metrics by platform and daypart?',
      question_zh: '各平台、各时段当前配送时长指标如何？',
      priority: 'P1',
      source: 'Delivery platform performance exports',
    },
    {
      id: 'D-005',
      question: 'What are the top refund reasons and which channels do they cluster in?',
      question_zh: '主要退款原因是什么，集中在哪些渠道？',
      priority: 'P1',
      source: 'Refund log / support tickets',
    },
  ];
}

async function maybeEnrichPlanner(
  draft: AgentCPlannerResult,
  analyzed: AgentBAnalysisResult['analysis']
): Promise<Pick<AgentCPlannerResult['plan'], 'north_star' | 'release_notes'> | null> {
  return runOpenAIJsonSchema<Pick<AgentCPlannerResult['plan'], 'north_star' | 'release_notes'>>({
    model: process.env.OPENAI_PLANNER_MODEL || 'gpt-4o',
    temperature: 0.15,
    maxOutputTokens: 1400,
    prompt: [
      'You are Agent C for RestaurantIQ. Transform Agent B analysis into a 14-day bilingual execution plan.',
      'You are only refining the north_star and release_notes sections of an already valid plan.',
      'Do not change task count, experiments, or data request count.',
      JSON.stringify({
        agent_b_analysis: analyzed,
        current_plan: draft.plan,
      }),
    ].join('\n'),
    schemaName: 'agent_c_plan_enrichment',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['north_star', 'release_notes'],
      properties: {
        north_star: {
          type: 'object',
          additionalProperties: false,
          required: ['objective', 'objective_zh', 'time_horizon_days', 'primary_metrics', 'review_cadence', 'review_cadence_zh'],
          properties: {
            objective: { type: 'string' },
            objective_zh: { type: 'string' },
            time_horizon_days: { type: 'number' },
            primary_metrics: { type: 'array', items: { type: 'string' } },
            review_cadence: { type: 'string' },
            review_cadence_zh: { type: 'string' },
          },
        },
        release_notes: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'summary_zh', 'internal'],
          properties: {
            summary: { type: 'string' },
            summary_zh: { type: 'string' },
            internal: { type: 'string' },
          },
        },
      },
    },
  });
}

export async function runAgentCPlanner(analyzed: AgentBAnalysisResult): Promise<{
  planned: AgentCPlannerResult;
  output: AgentOutput;
}> {
  const analysis = analyzed.analysis;
  const tasks = buildDefaultTasks(analysis);
  const experiments = buildDefaultExperiments(analysis);
  const dataRequests = buildDefaultDataRequests();

  const draft: AgentCPlannerResult = {
    plan: {
      north_star: {
        objective: `Improve store health from ${analysis.summary.health_grade} to the next grade within 14 days.`,
        objective_zh: `在 14 天内把门店健康等级从 ${analysis.summary.health_grade_zh} 提升到更高一级。`,
        time_horizon_days: 14,
        primary_metrics: ['discount_rate', 'aov', 'orders'],
        review_cadence: 'Daily for 7 days, then every 2 days',
        review_cadence_zh: '前7天每日，之后每2天',
      },
      task_board: {
        columns: [...TASK_COLUMNS],
        tasks,
      },
      experiments,
      data_requests: dataRequests,
      assumptions: [
        { en: 'Uploaded operating data reflects recent store performance.', zh: '上传的经营数据能够代表近期门店表现。' },
        { en: 'Platform settings can be changed by the store manager within this 14-day window.', zh: '门店经理可以在这 14 天窗口内调整平台设置。' },
      ],
      release_notes: {
        summary: `Planned 8 execution tasks, 3 experiments, and 5 data requests around ${analysis.summary.top_issue.toLowerCase()}.`,
        summary_zh: `围绕“${analysis.summary.top_issue_zh}”规划了 8 项执行任务、3 个实验和 5 项数据补齐请求。`,
        internal: 'Deterministic planner generated the default 14-day operating board.',
      },
    },
  };

  const enriched = await maybeEnrichPlanner(draft, analysis);
  const planned = enriched
    ? {
        plan: {
          ...draft.plan,
          north_star: {
            ...draft.plan.north_star,
            ...enriched.north_star,
            time_horizon_days: 14,
            primary_metrics: Array.isArray(enriched.north_star.primary_metrics)
              ? enriched.north_star.primary_metrics.slice(0, 3)
              : draft.plan.north_star.primary_metrics,
          },
          release_notes: {
            ...draft.plan.release_notes,
            ...enriched.release_notes,
          },
        },
      }
    : draft;

  return {
    planned,
    output: {
      agent: 'C',
      title: 'Strategy Planner',
      summary: planned.plan.release_notes.summary,
      structuredPayload: planned,
      evidenceRefs: [],
      confidence: 0.84,
      warnings: planned.plan.data_requests.length < 5 ? ['Planner generated fewer than 5 data requests.'] : undefined,
    },
  };
}
