import type { AgentOutput } from '@/lib/types';
import type { AnalysisInput, StructuredOpsDigest } from '@/lib/server/orchestration/types';
import { runAgentAParser } from '@/lib/server/agents/agent-a-parser';

export function buildOpsDigest(): StructuredOpsDigest {
  throw new Error('buildOpsDigest has been replaced by runAgentAParser and should not be called directly.');
}

export async function runAgentAOps(input: AnalysisInput): Promise<{
  digest: StructuredOpsDigest;
  output: AgentOutput;
}> {
  const { parsed, output } = await runAgentAParser(input);
  return {
    digest: parsed,
    output,
  };
}
