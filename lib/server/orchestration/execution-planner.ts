import type { ExecutionPlanPreview, Recommendation } from '@/lib/types';
import { buildExecutionPlanPreview, evaluateRecommendationPolicy } from '@/lib/server/orchestration/policy-gate';

export function buildExecutionPlanPreviews(recommendations: Recommendation[]): ExecutionPlanPreview[] {
  return recommendations.map((recommendation) =>
    buildExecutionPlanPreview(recommendation, evaluateRecommendationPolicy(recommendation))
  );
}
