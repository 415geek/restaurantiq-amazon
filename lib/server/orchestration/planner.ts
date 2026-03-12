import type { AgentRun, EvidenceRef } from '@/lib/types';
import type { AnalysisInput } from '@/lib/server/orchestration/types';

export type PlannedTask = {
  agent: 'A' | 'B' | 'C' | 'D';
  mode: 'required' | 'optional_if_connected' | 'final_synthesis';
  dependsOn?: Array<'A' | 'B' | 'C'>;
};

export type AnalysisPlan = {
  runId: string;
  tasks: PlannedTask[];
  plannerRun: AgentRun;
  plannerEvidence: EvidenceRef[];
  warnings: string[];
};

export function createAnalysisPlan(input: AnalysisInput): AnalysisPlan {
  const runId = crypto.randomUUID();
  const hasUploads = Boolean(input.uploadedDocuments?.length);
  const tasks: PlannedTask[] = [
    { agent: 'A', mode: 'required' },
    { agent: 'B', mode: 'optional_if_connected' },
    { agent: 'C', mode: 'required' },
    { agent: 'D', mode: 'final_synthesis', dependsOn: ['A', 'B', 'C'] },
  ];

  return {
    runId,
    tasks,
    plannerRun: {
      id: crypto.randomUUID(),
      runId,
      agent: 'planner',
      status: 'completed',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      inputSummary: hasUploads
        ? `Planning analysis for ${input.uploadedDocuments?.length} uploaded operations document(s).`
        : 'Planning analysis with restaurant profile and connected external adapters.',
      outputSummary: `Scheduled ${tasks.length} orchestration tasks with Agent D as final synthesis stage.`,
      confidence: 0.92,
    },
    plannerEvidence: [
      {
        id: `plan-${runId}`,
        sourceType: 'manual',
        sourceId: runId,
        title: 'Analysis plan generated',
        excerpt: hasUploads
          ? 'Planner detected manual uploads and prioritized Agent A ingestion before synthesis.'
          : 'Planner detected profile-driven analysis without manual upload overrides.',
        freshness: new Date().toISOString(),
        confidence: 0.92,
      },
    ],
    warnings: [],
  };
}
