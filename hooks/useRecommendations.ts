'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { runAnalysis } from '@/lib/api/analysis';
import { mockAnalysisResponse } from '@/lib/mock-data';
import type { AnalysisResponse, Recommendation } from '@/lib/types';

function sortRecommendations(items: Recommendation[], sortBy: 'composite' | 'impact' | 'urgency') {
  const urgencyRank = { high: 3, medium: 2, low: 1 } as const;
  return [...items].sort((a, b) => {
    if (sortBy === 'impact') return b.impact_score - a.impact_score;
    if (sortBy === 'urgency') return urgencyRank[b.urgency_level] - urgencyRank[a.urgency_level];
    const aScore = a.impact_score * 0.5 + (a.feasibility_score ?? 5) * 0.2 + urgencyRank[a.urgency_level] * 1.5 + (a.confidence ?? 70) / 50;
    const bScore = b.impact_score * 0.5 + (b.feasibility_score ?? 5) * 0.2 + urgencyRank[b.urgency_level] * 1.5 + (b.confidence ?? 70) / 50;
    return bScore - aScore;
  });
}

export function useRecommendations(initial?: AnalysisResponse) {
  const [analysis, setAnalysis] = useState<AnalysisResponse>(initial ?? mockAnalysisResponse);
  const [sortBy, setSortBy] = useState<'composite' | 'impact' | 'urgency'>('composite');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommendations = useMemo(
    () => sortRecommendations(analysis.recommendations, sortBy),
    [analysis.recommendations, sortBy]
  );

  const refresh = async (input?: Parameters<typeof runAnalysis>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const data = await runAnalysis({ ...input, sortBy });
      startTransition(() => setAnalysis(data));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
      startTransition(() => setAnalysis({ ...mockAnalysisResponse, source: 'fallback', warning: 'Live analysis unavailable, showing mock recommendations.' }));
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      setAnalysis((prev) => ({ ...prev, recommendations: sortRecommendations(prev.recommendations, sortBy) }));
    });
  }, [sortBy]);

  return { analysis, recommendations, loading, error, sortBy, setSortBy, refresh, setAnalysis };
}
