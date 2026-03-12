import type { AnalysisResponse, UploadedOpsDocument } from '@/lib/types';

export type AnalysisRuntimeState = {
  analysis: AnalysisResponse;
  uploadedDocuments: UploadedOpsDocument[];
  updatedAt: string;
};
