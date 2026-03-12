import type { AnalysisResponse, AgentOutput } from '@/lib/types';
import type {
  AnalysisInput,
  RecommendationCandidate,
  StructuredMacroDigest,
  StructuredOpsDigest,
  StructuredSocialDigest,
} from '@/lib/server/orchestration/types';
import { runAgentCPlanner } from '@/lib/server/agents/agent-c-planner';
import { runAgentDValidator } from '@/lib/server/agents/agent-d-validator';

export async function runAgentDSynthesis(input: {
  analysisInput: AnalysisInput;
  agentA: StructuredOpsDigest;
  agentB: StructuredSocialDigest;
  agentC?: StructuredMacroDigest;
}): Promise<{
  analysis: AnalysisResponse;
  output: AgentOutput;
  candidates: RecommendationCandidate[];
}> {
  const planned = input.agentC
    ? { planned: input.agentC, output: undefined }
    : await runAgentCPlanner(input.agentB);
  const { validated, output } = await runAgentDValidator({
    analyzed: input.agentB,
    planned: planned.planned,
  });

  const candidates = validated.validated_plan.task_board.tasks.map((task) => ({
    id: task.task_id,
    title: task.title,
    description: `${task.goal} ${task.why_now}`.trim(),
    impact_score: task.priority === 'P0' ? 10 : task.priority === 'P1' ? 8 : 6,
    urgency_level: task.timeframe_days <= 3 ? 'high' : task.timeframe_days <= 7 ? 'medium' : 'low',
    feasibility_score: Math.max(6, 10 - Math.min(task.steps.length + task.checklist.length, 4)),
    category:
      task.module === 'Promotions'
        ? 'pricing'
        : task.module === 'Platform'
          ? 'marketing'
          : 'operations',
    execution_params: {
      taskId: task.task_id,
      owners: task.owners,
      module: task.module,
      platforms: task.platforms,
      steps: task.steps,
      checklist: task.checklist,
    },
    expected_outcome: task.done_criteria[0] ?? validated.frontend_ready.quick_stats.potential_impact,
    rollback_available: true,
    risk_level: task.priority === 'P0' ? 'high' : task.priority === 'P1' ? 'medium' : 'low',
    confidence: 86,
    rationale: [task.why_now],
    evidence_refs: [],
    assumptions: ['Compatibility shim generated this recommendation from the validated plan.'],
  })) satisfies RecommendationCandidate[];

  const analysis: AnalysisResponse = {
    summary: {
      headline: `${input.agentB.analysis.summary.restaurant_name || 'Restaurant'} · Health ${validated.frontend_ready.health_badge.score}/${validated.frontend_ready.health_badge.grade}`,
      insight:
        validated.frontend_ready.top_actions[0]?.title_zh
        ?? input.agentB.analysis.summary.top_issue_zh
        ?? '已生成可执行计划。',
      confidence: Math.max(0.6, validated.qa_report.completeness_score / 100),
      riskNotice:
        validated.qa_report.warnings[0]
        ?? validated.validated_plan.release_notes.summary_zh,
    },
    recommendations: candidates,
    source: validated.qa_report.status === 'pass' ? 'live' : 'fallback',
    warning: validated.qa_report.warnings[0],
    agentSignals: [],
    uploadedDocuments: input.analysisInput.uploadedDocuments,
    agentAParsed: input.agentA,
    agentBAnalyzed: input.agentB.analysis,
    validatedPlan: validated.validated_plan,
    qaReport: validated.qa_report,
    frontendReady: validated.frontend_ready,
    orchestration: {
      runId: crypto.randomUUID(),
      status: validated.qa_report.status === 'pass' ? 'completed' : 'partial_failure',
      agentRuns: [],
      agentOutputs: [],
      evidence: [],
      warnings: validated.qa_report.warnings,
    },
    executionPlansPreview: [],
  };

  return {
    analysis,
    output,
    candidates,
  };
}
