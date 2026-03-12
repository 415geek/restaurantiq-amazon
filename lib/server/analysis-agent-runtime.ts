import { orchestrateRestaurantAnalysis } from '@/lib/server/orchestration/analysis-orchestrator';
import type { AnalysisInput } from '@/lib/server/orchestration/types';

export async function runRestaurantMultiAgentAnalysis(input: AnalysisInput) {
  return orchestrateRestaurantAnalysis(input);
}

export { orchestrateRestaurantAnalysis };
export type { AnalysisInput };
