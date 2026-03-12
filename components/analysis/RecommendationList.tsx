'use client';

import { RecommendationCard } from '@/components/dashboard/RecommendationCard';
import type { ExecutionTask, Recommendation } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function RecommendationList({
  recommendations,
  tasks,
  onExecute,
  onRollback,
}: {
  recommendations: Recommendation[];
  tasks: Record<string, ExecutionTask>;
  onExecute: (rec: Recommendation) => Promise<void>;
  onRollback: (rec: Recommendation) => Promise<void>;
}) {
  const { copy } = useDashboardLanguage();
  if (recommendations.length === 0) {
    return <div className="rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-400">{copy.analysisPage.noRecommendations}</div>;
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <RecommendationCard key={rec.id} recommendation={rec} task={tasks[rec.id]} onExecute={onExecute} onRollback={onRollback} />
      ))}
    </div>
  );
}
