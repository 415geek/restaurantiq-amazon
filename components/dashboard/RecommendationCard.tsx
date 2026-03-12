'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Play, RotateCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ImpactScoreBadge } from '@/components/analysis/ImpactScoreBadge';
import { ExecutionPreviewModal } from '@/components/analysis/ExecutionPreviewModal';
import { RecommendationDetailSections } from '@/components/dashboard/RecommendationDetailSections';
import type { ExecutionTask, Recommendation } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

function formatRemaining(ms?: number) {
  if (!ms || ms <= 0) return 'Expired';
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RecommendationCard({
  recommendation,
  task,
  onExecute,
  onRollback,
  compact,
}: {
  recommendation: Recommendation;
  task?: ExecutionTask;
  onExecute: (rec: Recommendation) => Promise<void>;
  onRollback: (rec: Recommendation) => Promise<void>;
  compact?: boolean;
}) {
  const { copy, lang } = useDashboardLanguage();
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (!task?.rollbackDeadline) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [task?.rollbackDeadline]);

  const remaining = task?.rollbackDeadline ? task.rollbackDeadline - tick : undefined;
  const canRollback = Boolean(task && task.status === 'completed' && recommendation.rollback_available && (remaining ?? 0) > 0);
  const statusLabel = task ? copy.recommendation.statuses[task.status] : null;
  const riskLabel = copy.recommendation.risk[recommendation.risk_level ?? 'low'];

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="capitalize">{recommendation.category}</Badge>
                <ImpactScoreBadge score={recommendation.impact_score} />
                <Badge className={cn(
                  recommendation.risk_level === 'high' ? 'border-red-500/30 bg-red-500/10 text-red-300' : recommendation.risk_level === 'medium' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                )}>{riskLabel}</Badge>
                {task ? <Badge className="border-zinc-700 bg-zinc-950 text-zinc-200">{statusLabel}</Badge> : null}
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  {lang === 'zh' ? recommendation.title_zh ?? recommendation.title : recommendation.title}
                </h3>
                <p className={cn('mt-1 text-sm text-zinc-400', compact && !expanded && 'line-clamp-2')}>{recommendation.description}</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                <span>{copy.recommendation.urgency}: {recommendation.urgency_level}</span>
                <span>{copy.recommendation.feasibility}: {recommendation.feasibility_score ?? '-'}/10</span>
                <span>{copy.recommendation.confidence}: {recommendation.confidence ?? '-'}%</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-end">
              <Button
                variant="primary"
                size="sm"
                className="shadow-md shadow-[#F26A36]/20"
                onClick={() => setPreviewOpen(true)}
              >
                <Play className="h-4 w-4" /> {copy.recommendation.executePreview}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} /> {expanded ? copy.recommendation.hide : copy.recommendation.details}
              </Button>
              {canRollback ? (
                <Button variant="danger" size="sm" onClick={() => onRollback(recommendation)}>
                  <RotateCcw className="h-4 w-4" /> {copy.recommendation.rollbackLabel} {formatRemaining(remaining)}
                </Button>
              ) : task?.status === 'completed' && recommendation.rollback_available ? (
                <div className="text-xs text-zinc-500">{copy.recommendation.rollbackWindow}: {formatRemaining(remaining)}</div>
              ) : null}
            </div>
          </div>
          {expanded ? (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
              <RecommendationDetailSections recommendation={recommendation} />
              {recommendation.risk_level === 'high' ? (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-200">
                  <ShieldAlert className="mt-0.5 h-4 w-4" /> {copy.recommendation.highRiskNotice}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <ExecutionPreviewModal recommendation={recommendation} open={previewOpen} onOpenChange={setPreviewOpen} onConfirm={onExecute} loading={task?.status === 'pending' || task?.status === 'executing'} />
    </>
  );
}
