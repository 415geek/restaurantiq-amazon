import type { AgentOutput, AgentRun, EvidenceRef } from '@/lib/types';

export function finalizeRunStatus(agentRuns: AgentRun[]): 'completed' | 'partial_failure' | 'failed' {
  const hasFailure = agentRuns.some((run) => run.status === 'failed');
  const hasPartial = agentRuns.some((run) => run.status === 'partial');
  if (hasFailure && agentRuns.every((run) => run.status === 'failed' || run.agent === 'planner')) {
    return 'failed';
  }
  if (hasFailure || hasPartial) return 'partial_failure';
  return 'completed';
}

export function mergeEvidence(agentOutputs: AgentOutput[], plannerEvidence: EvidenceRef[]): EvidenceRef[] {
  const all = [...plannerEvidence, ...agentOutputs.flatMap((output) => output.evidenceRefs)];
  const seen = new Set<string>();
  return all.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
