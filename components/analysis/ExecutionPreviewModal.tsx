'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import SwipeToConfirm from '@/components/SwipeToConfirm';
import { RecommendationDetailSections } from '@/components/dashboard/RecommendationDetailSections';
import type { Recommendation } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function ExecutionPreviewModal({
  recommendation,
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  recommendation: Recommendation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (recommendation: Recommendation) => Promise<void>;
  loading?: boolean;
}) {
  const { copy, lang } = useDashboardLanguage();
  const [error, setError] = useState<string | null>(null);

  if (!recommendation) return null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={copy.executionPreview.title}>
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge className="border-orange-500/30 bg-orange-500/10 text-orange-300">{recommendation.category}</Badge>
            <Badge>{recommendation.urgency_level}</Badge>
            {recommendation.rollback_available ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{copy.executionPreview.rollbackAvailable}</Badge> : null}
          </div>
          <h4 className="text-lg font-semibold text-zinc-100">{lang === 'zh' ? recommendation.title_zh ?? recommendation.title : recommendation.title}</h4>
          <p className="mt-1 text-sm text-zinc-400">{recommendation.description}</p>
        </div>
        <RecommendationDetailSections recommendation={recommendation} />
        {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</div> : null}
        <div className="space-y-3">
          <SwipeToConfirm
            label={copy.executionPreview.slideLabel}
            confirmLabel={copy.executionPreview.slideConfirm}
            loading={loading}
            onConfirm={async () => {
              setError(null);
              try {
                await onConfirm(recommendation);
                onOpenChange(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : copy.executionPreview.errorFallback);
                throw e;
              }
            }}
          />
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{copy.executionPreview.cancel}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
