import type { ExecutionPlanPreview, Recommendation } from '@/lib/types';
import type { PolicyDecision } from '@/lib/server/orchestration/types';

export function evaluateRecommendationPolicy(recommendation: Recommendation): PolicyDecision {
  const isHighRisk = recommendation.risk_level === 'high';
  const requiresHumanConfirmation = isHighRisk || recommendation.impact_score >= 8;
  const blockedByPolicy = false;
  const reasons = [
    requiresHumanConfirmation
      ? 'High-impact or higher-risk recommendation requires explicit user confirmation before execution.'
      : 'Recommendation is eligible for standard approval flow.',
  ];

  return {
    recommendationId: recommendation.id,
    blockedByPolicy,
    requiresHumanConfirmation,
    riskLevel: recommendation.risk_level ?? 'medium',
    reasons,
    rollbackWindowMinutes: recommendation.rollback_available ? 3 : undefined,
  };
}

export function buildExecutionPlanPreview(
  recommendation: Recommendation,
  policy: PolicyDecision
): ExecutionPlanPreview {
  return {
    recommendationId: recommendation.id,
    requiresHumanConfirmation: policy.requiresHumanConfirmation,
    blockedByPolicy: policy.blockedByPolicy,
    riskLevel: policy.riskLevel,
    rollbackAvailable: recommendation.rollback_available,
    rollbackWindowMinutes: policy.rollbackWindowMinutes,
    reasons: policy.reasons,
    actions: [
      {
        system: 'internal',
        operation: 'prepare_execution_preview',
        params: {
          recommendationId: recommendation.id,
          category: recommendation.category,
          executionParams: recommendation.execution_params,
        },
      },
    ],
  };
}
