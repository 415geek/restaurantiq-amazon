import { createAnalysisPlan } from '@/lib/server/orchestration/planner';
import { runAgentAParser } from '@/lib/server/agents/agent-a-parser';
import { runAgentBAnalyzer } from '@/lib/server/agents/agent-b-analyzer';
import { runAgentCPlanner } from '@/lib/server/agents/agent-c-planner';
import { runAgentDValidator } from '@/lib/server/agents/agent-d-validator';
import { buildExecutionPlanPreviews } from '@/lib/server/orchestration/execution-planner';
import { finalizeRunStatus, mergeEvidence } from '@/lib/server/orchestration/supervisor';
import type {
  AnalysisResponse,
  AgentAMonthlyTrendPoint,
  AgentDValidatorResult,
  AgentOutput,
  AgentRun,
  AgentSignal,
  Recommendation,
  RecommendationCategory,
  RiskLevel,
} from '@/lib/types';
import type { AnalysisInput } from '@/lib/server/orchestration/types';

function createAgentRun(
  runId: string,
  agent: AgentRun['agent'],
  inputSummary: string,
  outputSummary: string,
  confidence = 0.8,
  warnings?: string[],
  status: AgentRun['status'] = 'completed'
): AgentRun {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    runId,
    agent,
    status,
    startedAt: now,
    finishedAt: now,
    inputSummary,
    outputSummary,
    confidence,
    warnings,
  };
}

function mapTaskCategory(module: string): RecommendationCategory {
  switch (module) {
    case 'Promotions':
      return 'pricing';
    case 'Platform':
      return 'marketing';
    case 'Menu':
      return 'operations';
    case 'Ops':
    default:
      return 'operations';
  }
}

function mapTaskRisk(task: {
  priority: 'P0' | 'P1' | 'P2';
  module: string;
  timeframe_days: number;
}): RiskLevel {
  if (task.priority === 'P0' && (task.module === 'Promotions' || task.module === 'Platform')) {
    return 'high';
  }
  if (task.priority === 'P1' || task.timeframe_days <= 7) {
    return 'medium';
  }
  return 'low';
}

function mapUrgencyLevel(timeframeDays: number): Recommendation['urgency_level'] {
  if (timeframeDays <= 3) return 'high';
  if (timeframeDays <= 7) return 'medium';
  return 'low';
}

function mapImpactScore(priority: 'P0' | 'P1' | 'P2', timeframeDays: number) {
  if (priority === 'P0') return timeframeDays <= 3 ? 10 : 9;
  if (priority === 'P1') return timeframeDays <= 7 ? 8 : 7;
  return 6;
}

function mapFeasibilityScore(task: { checklist: unknown[]; steps: unknown[]; timeframe_days: number }) {
  const complexity = (task.checklist?.length ?? 0) + (task.steps?.length ?? 0);
  if (complexity <= 3 && task.timeframe_days <= 5) return 9;
  if (complexity <= 5 && task.timeframe_days <= 7) return 8;
  if (complexity <= 8) return 7;
  return 6;
}

function getPeakDiscountMonth(monthlyTrend: AgentAMonthlyTrendPoint[]) {
  return [...monthlyTrend]
    .filter((item) => item.discountRate > 0)
    .sort((left, right) => right.discountRate - left.discountRate)[0];
}

function getPeakOrderMonth(monthlyTrend: AgentAMonthlyTrendPoint[]) {
  return [...monthlyTrend]
    .filter((item) => item.dailyOrders > 0)
    .sort((left, right) => right.dailyOrders - left.dailyOrders)[0];
}

function buildRecommendationNarrative(
  task: AgentDValidatorResult['validated_plan']['task_board']['tasks'][number],
  parsedOverview: AnalysisResponse['agentAParsed'] | undefined
) {
  const monthlyTrend = parsedOverview?.monthly_trend ?? [];
  const peakDiscountMonth = getPeakDiscountMonth(monthlyTrend);
  const peakOrderMonth = getPeakOrderMonth(monthlyTrend);
  const averageDiscountRate = parsedOverview?.overview.discount_rate;
  const whyFindingZh =
    task.module === 'Promotions' && peakDiscountMonth
      ? `${peakDiscountMonth.monthLabel}折扣率达到 ${peakDiscountMonth.discountRate.toFixed(1)}%，明显高于其余月份的 6%-8% 区间。`
      : `${task.why_now_zh || task.why_now}`;
  const whyFindingEn =
    task.module === 'Promotions' && peakDiscountMonth
      ? `${peakDiscountMonth.monthLabelEn} discount rate reached ${peakDiscountMonth.discountRate.toFixed(1)}%, above the 6-8% range seen in other months.`
      : task.why_now;
  const whyEvidenceZh =
    task.module === 'Promotions' && peakDiscountMonth
      ? `${peakDiscountMonth.monthLabel}优惠金额 $${peakDiscountMonth.discountTotal.toFixed(0)}，营收 $${peakDiscountMonth.revenue.toFixed(0)}。${peakOrderMonth ? `${peakOrderMonth.monthLabel}日均订单达到 ${peakOrderMonth.dailyOrders.toFixed(1)} 单。` : ''}`
      : `当前解析结果显示：${parsedOverview?.overview.total_revenue ? `累计营收 $${parsedOverview.overview.total_revenue.toFixed(2)}` : '已完成上传数据解析'}，系统已识别需要优先处理的运营动作。`;
  const whyEvidenceEn =
    task.module === 'Promotions' && peakDiscountMonth
      ? `${peakDiscountMonth.monthLabelEn} discounts totaled $${peakDiscountMonth.discountTotal.toFixed(0)} against $${peakDiscountMonth.revenue.toFixed(0)} revenue.${peakOrderMonth ? ` ${peakOrderMonth.monthLabelEn} peaked at ${peakOrderMonth.dailyOrders.toFixed(1)} daily orders.` : ''}`
      : parsedOverview?.overview.total_revenue
        ? `Parsed revenue has reached $${parsedOverview.overview.total_revenue.toFixed(2)}, which supports prioritizing this action now.`
        : 'Uploaded operating data has been parsed and surfaced this priority action.';
  const whyBenchmarkZh =
    averageDiscountRate !== null && averageDiscountRate !== undefined
      ? `行业健康折扣率通常为 5%-8%。当前 6 个月平均折扣率为 ${averageDiscountRate.toFixed(1)}%。`
      : '行业健康折扣率通常为 5%-8%，建议将促销强度稳定在可控区间。';
  const whyBenchmarkEn =
    averageDiscountRate !== null && averageDiscountRate !== undefined
      ? `A healthy restaurant discount range is typically 5-8%. Your 6-month average is ${averageDiscountRate.toFixed(1)}%.`
      : 'A healthy restaurant discount range is typically 5-8%, and promotions should remain within that band.';

  const benefitZh = task.goal_zh || task.goal;
  const benefitEn = task.goal;
  const financialZh =
    task.module === 'Promotions'
      ? '预计每月可减少约 $500-$800 的无效折扣支出，同时保持订单量稳定。'
      : task.done_criteria_zh?.[0] || task.done_criteria[0] || '预计改善当前关键经营指标。';
  const financialEn =
    task.module === 'Promotions'
      ? 'Expected to reduce $500-$800 of unnecessary monthly discount spend while maintaining order volume.'
      : task.done_criteria[0] || 'Expected to improve the target operating KPI.';
  const timelineZh =
    task.timeframe_days <= 7
      ? `执行后 ${task.timeframe_days} 天内可观察到初步变化。`
      : `执行后 2-4 周可观察到稳定变化。`;
  const timelineEn =
    task.timeframe_days <= 7
      ? `Initial movement should be visible within ${task.timeframe_days} days.`
      : 'Stable results should appear within 2-4 weeks.';

  const rollbackZh =
    task.stop_loss.rollback.join('；')
    || '恢复此前被暂停或修改的策略配置。';
  const rollbackEn =
    task.stop_loss.rollback.join('; ')
    || 'Restore the previously paused or modified configuration.';

  return {
    why: {
      finding: whyFindingEn,
      finding_zh: whyFindingZh,
      data_evidence: whyEvidenceEn,
      data_evidence_zh: whyEvidenceZh,
      benchmark: whyBenchmarkEn,
      benchmark_zh: whyBenchmarkZh,
    },
    impact: {
      benefit: benefitEn,
      benefit_zh: benefitZh,
      financial: financialEn,
      financial_zh: financialZh,
      timeline: timelineEn,
      timeline_zh: timelineZh,
    },
    steps: task.steps.map((step) => step.action),
    steps_zh: task.steps.map((step) => step.action_zh || step.action),
    stop_loss: task.stop_loss.trigger,
    stop_loss_zh: task.stop_loss.trigger_zh || task.stop_loss.trigger,
    rollback: rollbackEn,
    rollback_zh: rollbackZh,
  };
}

function buildRecommendations(
  input: AnalysisInput,
  parsedOverview: AnalysisResponse['agentAParsed'] | undefined,
  taskBoard: AgentDValidatorResult['validated_plan']['task_board'],
  topOpportunity: string
): Recommendation[] {
  const recommendations = taskBoard.tasks.map((task, index) => {
    const riskLevel = mapTaskRisk(task);
    const narrative = buildRecommendationNarrative(task, parsedOverview);
    return {
      id: task.task_id,
      title: task.title,
      title_zh: task.title_zh || task.title,
      description: `${task.goal} ${task.why_now}`.trim(),
      impact_score: mapImpactScore(task.priority, task.timeframe_days),
      urgency_level: mapUrgencyLevel(task.timeframe_days),
      feasibility_score: mapFeasibilityScore(task),
      category: mapTaskCategory(task.module),
      execution_params: {
        taskId: task.task_id,
        module: task.module,
        owners: task.owners,
        platforms: task.platforms,
        steps: task.steps,
        checklist: task.checklist,
        measurement: task.measurement,
        stopLoss: task.stop_loss,
        doneCriteria: task.done_criteria,
        timeframeDays: task.timeframe_days,
        position: index + 1,
      },
      expected_outcome: task.done_criteria[0] || topOpportunity,
      rollback_available: true,
      risk_level: riskLevel,
      confidence: Math.max(65, 94 - index * 3),
      why: narrative.why,
      impact: narrative.impact,
      steps: narrative.steps,
      steps_zh: narrative.steps_zh,
      stop_loss: narrative.stop_loss,
      stop_loss_zh: narrative.stop_loss_zh,
      rollback: narrative.rollback,
      rollback_zh: narrative.rollback_zh,
    } satisfies Recommendation;
  });

  const sortBy = input.sortBy ?? 'composite';
  if (sortBy === 'impact') {
    return [...recommendations].sort((left, right) => right.impact_score - left.impact_score);
  }
  if (sortBy === 'urgency') {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return [...recommendations].sort(
      (left, right) =>
        order[left.urgency_level] - order[right.urgency_level] || right.impact_score - left.impact_score
    );
  }
  return [...recommendations].sort((left, right) => {
    const compositeLeft =
      left.impact_score * 100 + (left.feasibility_score ?? 0) * 10 + (left.confidence ?? 0);
    const compositeRight =
      right.impact_score * 100 + (right.feasibility_score ?? 0) * 10 + (right.confidence ?? 0);
    return compositeRight - compositeLeft;
  });
}

function buildAgentSignals(agentRuns: AgentRun[], agentOutputs: AgentOutput[]): AgentSignal[] {
  const outputByAgent = new Map(agentOutputs.map((output) => [output.agent, output]));
  return (['A', 'B', 'C', 'D'] as const).map((agent) => {
    const run = agentRuns.find((entry) => entry.agent === agent);
    const output = outputByAgent.get(agent);
    return {
      agent,
      title: output?.title || `Agent ${agent}`,
      status:
        run?.status === 'failed'
          ? 'error'
          : run?.status === 'partial'
            ? 'missing'
            : output
              ? 'connected'
              : 'missing',
      summary: output?.summary || run?.outputSummary || `Agent ${agent} did not produce output.`,
      lastUpdatedAt: run?.finishedAt || new Date().toISOString(),
    };
  });
}

function buildSummary(
  response: Pick<AnalysisResponse, 'agentBAnalyzed' | 'validatedPlan' | 'qaReport' | 'frontendReady' | 'executionPlansPreview'>
): AnalysisResponse['summary'] {
  const analyzed = response.agentBAnalyzed;
  const topAction = response.frontendReady?.top_actions[0];
  const humanReviewRequired =
    response.executionPlansPreview?.filter((item) => item.requiresHumanConfirmation).length ?? 0;
  const restaurant = analyzed?.summary.restaurant_name?.trim() || 'Restaurant';
  const healthBadge = response.frontendReady?.health_badge;
  const healthText = healthBadge
    ? `Health ${healthBadge.score} / ${healthBadge.grade}`
    : analyzed?.summary.health_grade
      ? `Health ${analyzed.summary.health_grade}`
      : 'Health baseline unavailable';

  return {
    headline: `${restaurant} · ${healthText}`,
    insight: topAction
      ? `${analyzed?.summary.top_issue_zh || analyzed?.summary.top_issue || '当前需要优先修复核心经营问题。'} 优先动作：${topAction.title_zh || topAction.title}`
      : analyzed?.summary.top_issue_zh || analyzed?.summary.top_issue || '已完成上传数据分析。',
    confidence: Math.max(0.6, (response.qaReport?.completeness_score ?? 72) / 100),
    riskNotice:
      humanReviewRequired > 0
        ? `${humanReviewRequired} 项建议需要人工确认后才能执行。`
        : response.qaReport?.warnings?.[0],
  };
}

export async function orchestrateRestaurantAnalysis(input: AnalysisInput): Promise<AnalysisResponse> {
  const plan = createAnalysisPlan(input);
  const uploadedDocuments = input.uploadedDocuments ?? [];

  const agentA = await runAgentAParser(input);
  const agentARun = createAgentRun(
    plan.runId,
    'A',
    uploadedDocuments.length
      ? `Received ${uploadedDocuments.length} uploaded operations document(s) for parsing.`
      : 'No uploaded operating documents provided.',
    agentA.output.summary,
    agentA.output.confidence,
    agentA.output.warnings,
    uploadedDocuments.length ? 'completed' : 'partial'
  );

  const agentB = await runAgentBAnalyzer(agentA.parsed);
  const agentBRun = createAgentRun(
    plan.runId,
    'B',
    `Analyzing ${agentA.parsed.meta.data_sources.length} normalized data source(s) from Agent A.`,
    agentB.output.summary,
    agentB.output.confidence,
    agentB.output.warnings
  );

  const agentC = await runAgentCPlanner(agentB.analyzed);
  const agentCRun = createAgentRun(
    plan.runId,
    'C',
    `Planning a 14-day action board from ${agentB.analyzed.analysis.insights.length} KPI insight(s).`,
    agentC.output.summary,
    agentC.output.confidence,
    agentC.output.warnings
  );

  const agentD = await runAgentDValidator({ analyzed: agentB.analyzed, planned: agentC.planned });
  const agentDRun = createAgentRun(
    plan.runId,
    'D',
    `Validating ${agentC.planned.plan.task_board.tasks.length} planned task(s), ${agentC.planned.plan.experiments.length} experiment(s), and ${agentC.planned.plan.data_requests.length} data request(s).`,
    agentD.output.summary,
    agentD.output.confidence,
    agentD.output.warnings,
    agentD.validated.qa_report.status === 'incomplete'
      ? 'partial'
      : agentD.validated.qa_report.status === 'fail'
        ? 'failed'
        : 'completed'
  );

  const recommendations = buildRecommendations(
    input,
    agentA.parsed,
    agentD.validated.validated_plan.task_board,
    agentD.validated.frontend_ready.quick_stats.potential_impact
  );
  const executionPlansPreview = buildExecutionPlanPreviews(recommendations);
  const executionPlannerRun = createAgentRun(
    plan.runId,
    'execution_planner',
    `Preparing execution previews for ${recommendations.length} recommendation(s).`,
    `Generated ${executionPlansPreview.length} execution preview plan(s).`,
    0.88
  );
  const policyRun = createAgentRun(
    plan.runId,
    'policy',
    'Evaluating execution risk and human confirmation requirements.',
    `${executionPlansPreview.filter((item) => item.requiresHumanConfirmation).length} recommendation(s) require explicit confirmation.`,
    0.9
  );

  const agentRuns = [
    plan.plannerRun,
    agentARun,
    agentBRun,
    agentCRun,
    agentDRun,
    policyRun,
    executionPlannerRun,
  ];
  const agentOutputs = [agentA.output, agentB.output, agentC.output, agentD.output];
  const evidence = mergeEvidence(agentOutputs, plan.plannerEvidence);
  const finalStatus = finalizeRunStatus(agentRuns);
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const warningMessages = [
    ...plan.warnings,
    ...agentOutputs.flatMap((output) => output.warnings ?? []),
    ...agentD.validated.qa_report.warnings,
    ...(!openAiConfigured ? ['OpenAI live orchestration is unavailable. Deterministic orchestration output is being shown.'] : []),
  ].filter(Boolean);

  const response: AnalysisResponse = {
    summary: buildSummary({
      agentBAnalyzed: agentB.analyzed.analysis,
      validatedPlan: agentD.validated.validated_plan,
      qaReport: agentD.validated.qa_report,
      frontendReady: agentD.validated.frontend_ready,
      executionPlansPreview,
    }),
    recommendations,
    agentSignals: buildAgentSignals(agentRuns, agentOutputs),
    source: openAiConfigured ? 'live' : 'fallback',
    warning: warningMessages[0],
    agentAParsed: agentA.parsed,
    agentBAnalyzed: agentB.analyzed.analysis,
    validatedPlan: agentD.validated.validated_plan,
    qaReport: agentD.validated.qa_report,
    frontendReady: agentD.validated.frontend_ready,
    uploadedDocuments,
    orchestration: {
      runId: plan.runId,
      status: finalStatus,
      agentRuns,
      agentOutputs,
      evidence,
      warnings: warningMessages,
    },
    executionPlansPreview,
  };

  return response;
}
