import type {
  AgentAParserResult,
  AgentBAnalysisResult,
  AgentCPlannerResult,
  AgentDValidatorResult,
  Recommendation,
  RiskLevel,
  UploadedOpsDocument,
} from '@/lib/types';

export type AnalysisInput = {
  restaurantConfig?: Record<string, unknown>;
  uploadedDocuments?: UploadedOpsDocument[];
  sortBy?: 'composite' | 'impact' | 'urgency';
  userKey?: string;
};

export type StructuredOpsDigest = AgentAParserResult;

export type StructuredSocialDigest = AgentBAnalysisResult;

export type StructuredMacroDigest = AgentCPlannerResult;

export type RecommendationCandidate = Recommendation & {
  rationale: string[];
  evidence_refs: string[];
  assumptions: string[];
};

export type PolicyDecision = {
  recommendationId: string;
  blockedByPolicy: boolean;
  requiresHumanConfirmation: boolean;
  riskLevel: RiskLevel;
  reasons: string[];
  rollbackWindowMinutes?: number;
};

export type ValidatedAnalysisPayload = AgentDValidatorResult;
