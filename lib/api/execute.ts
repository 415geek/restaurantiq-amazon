import { apiFetch } from '@/lib/api/client';
import type { ExecuteResponse } from '@/lib/types';

export function executeRecommendation(recommendationId: string, executionParams: Record<string, unknown>) {
  return apiFetch<ExecuteResponse>('/api/execute', {
    method: 'POST',
    body: JSON.stringify({ recommendationId, execution_params: executionParams }),
  });
}

export function rollbackRecommendation(taskId: string) {
  return apiFetch<{ success: boolean; status: 'rolled_back'; task_id: string }>('/api/execute', {
    method: 'PATCH',
    body: JSON.stringify({ taskId }),
  });
}
