import type { AgentOutput } from '@/lib/types';
import type { AnalysisInput, StructuredSocialDigest } from '@/lib/server/orchestration/types';
import { runAgentAParser } from '@/lib/server/agents/agent-a-parser';
import { runAgentBAnalyzer } from '@/lib/server/agents/agent-b-analyzer';

export async function runAgentBSocial(
  input: AnalysisInput
): Promise<{ digest: StructuredSocialDigest; output: AgentOutput }> {
  const { parsed } = await runAgentAParser(input);
  const { analyzed, output } = await runAgentBAnalyzer(parsed);
  return {
    digest: analyzed,
    output,
  };
}
