import { apiFetch } from '@/lib/api/client';
import type {
  AnalysisResponse,
  BusinessSearchCandidate,
  SettingsState,
  UploadedOpsDocument,
} from '@/lib/types';

export type BusinessTargetInput = {
  name: string;
  address: string;
  googlePlaceId?: string;
  yelpBusinessId?: string;
  lat?: number;
  lng?: number;
};

export type RunAnalysisInput = {
  restaurantConfig?: Partial<SettingsState['restaurantProfile']>;
  sortBy?: 'composite' | 'impact' | 'urgency';
  compareMode?: boolean;
  uploadedDocuments?: UploadedOpsDocument[];
  businessTarget?: BusinessTargetInput;
};

export function runAnalysis(input: RunAnalysisInput = {}) {
  return apiFetch<AnalysisResponse>('/api/analysis', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function uploadOperationsDocuments(files: File[]) {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  return fetch('/api/analysis/upload', {
    method: 'POST',
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Failed to upload operations documents');
    }
    return res.json() as Promise<{ uploadedCount: number; parsedCount: number; documents: UploadedOpsDocument[] }>;
  });
}

export function searchBusinessesByAddress(address: string) {
  return apiFetch<{
    source: 'mock' | 'live' | 'fallback';
    address: string;
    candidates: BusinessSearchCandidate[];
    warning?: string;
  }>('/api/analysis/business-search', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
}

export function autocompleteAddress(query: string) {
  return apiFetch<{
    source: 'live' | 'fallback';
    warning?: string;
    suggestions: Array<{
      id: string;
      description: string;
      placeId?: string;
      lat?: number;
      lng?: number;
    }>;
  }>('/api/analysis/address-autocomplete', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}
