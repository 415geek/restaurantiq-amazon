import type { AgentOutput } from '@/lib/types';
import type { AnalysisInput, StructuredMacroDigest } from '@/lib/server/orchestration/types';
import { runAgentAParser } from '@/lib/server/agents/agent-a-parser';
import { runAgentBAnalyzer } from '@/lib/server/agents/agent-b-analyzer';
import { runAgentCPlanner } from '@/lib/server/agents/agent-c-planner';

export async function runAgentCMacro(
  input: AnalysisInput
): Promise<{ digest: StructuredMacroDigest; output: AgentOutput }> {
  const { parsed } = await runAgentAParser(input);
  const { analyzed } = await runAgentBAnalyzer(parsed);
  const { planned, output } = await runAgentCPlanner(analyzed);
  return {
    digest: planned,
    output,
  };
}
