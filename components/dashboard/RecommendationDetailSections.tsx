'use client';

import { Badge } from '@/components/ui/Badge';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type { Recommendation } from '@/lib/types';

function pickLocalized(
  lang: 'zh' | 'en',
  zhValue: string | undefined,
  enValue: string | undefined,
  fallback = '--'
) {
  if (lang === 'zh') return zhValue || enValue || fallback;
  return enValue || zhValue || fallback;
}

function pickLocalizedList(
  lang: 'zh' | 'en',
  zhList: string[] | undefined,
  enList: string[] | undefined
) {
  const items = lang === 'zh' ? zhList ?? enList ?? [] : enList ?? zhList ?? [];
  return items.filter(Boolean);
}

export function RecommendationDetailSections({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const { copy, lang } = useDashboardLanguage();
  const why = recommendation.why;
  const impact = recommendation.impact;
  const steps = pickLocalizedList(lang, recommendation.steps_zh, recommendation.steps);
  const stopLoss = pickLocalized(lang, recommendation.stop_loss_zh, recommendation.stop_loss);
  const rollback = pickLocalized(lang, recommendation.rollback_zh, recommendation.rollback);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-100">{copy.dashboardInsights.whyTitle}</p>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>
              <Badge className="mb-2 border-zinc-700 bg-zinc-900 text-zinc-200">
                {copy.dashboardInsights.whyFinding}
              </Badge>
              <p>{pickLocalized(lang, why?.finding_zh, why?.finding, recommendation.description)}</p>
            </div>
            <div>
              <Badge className="mb-2 border-zinc-700 bg-zinc-900 text-zinc-200">
                {copy.dashboardInsights.whyEvidence}
              </Badge>
              <p>{pickLocalized(lang, why?.data_evidence_zh, why?.data_evidence, recommendation.expected_outcome)}</p>
            </div>
            <div>
              <Badge className="mb-2 border-zinc-700 bg-zinc-900 text-zinc-200">
                {copy.dashboardInsights.whyBenchmark}
              </Badge>
              <p>{pickLocalized(lang, why?.benchmark_zh, why?.benchmark)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-100">{copy.dashboardInsights.impactTitle}</p>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>
              <Badge className="mb-2 border-zinc-700 bg-zinc-900 text-zinc-200">
                {copy.dashboardInsights.impactBenefit}
              </Badge>
              <p>{pickLocalized(lang, impact?.benefit_zh, impact?.benefit, recommendation.expected_outcome)}</p>
            </div>
            <div>
              <Badge className="mb-2 border-zinc-700 bg-zinc-900 text-zinc-200">
                {copy.dashboardInsights.impactFinancial}
              </Badge>
              <p>{pickLocalized(lang, impact?.financial_zh, impact?.financial)}</p>
            </div>
            <div>
              <Badge className="mb-2 border-zinc-700 bg-zinc-900 text-zinc-200">
                {copy.dashboardInsights.impactTimeline}
              </Badge>
              <p>{pickLocalized(lang, impact?.timeline_zh, impact?.timeline)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-100">{copy.dashboardInsights.stepsTitle}</p>
          {steps.length ? (
            <ol className="space-y-2 text-sm text-zinc-300">
              {steps.map((step, index) => (
                <li key={`${recommendation.id}-step-${index}`} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-200">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-400">--</p>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-100">{copy.dashboardInsights.riskTitle}</p>
          <div className="space-y-3 text-sm text-zinc-300">
            <div>
              <Badge className="mb-2 border-zinc-700 bg-zinc-900 text-zinc-200">
                {copy.dashboardInsights.stopLoss}
              </Badge>
              <p>{stopLoss}</p>
            </div>
            <div>
              <Badge className="mb-2 border-zinc-700 bg-zinc-900 text-zinc-200">
                {copy.dashboardInsights.rollbackPlan}
              </Badge>
              <p>{rollback}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
