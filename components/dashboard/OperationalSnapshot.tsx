'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type { DashboardInsightSnapshot } from '@/lib/client/analysis-runtime';

function sourceClass(source: DashboardInsightSnapshot['source']) {
  if (source === 'live') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (source === 'fallback') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
  return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
}

const FALLBACK_MONTHLY_TREND = [
  { monthKey: '2025-10', monthLabel: '10月', monthLabelEn: 'Oct', orders: 620, revenue: 28500, avgOrderValue: 46, dailyOrders: 20, discountRate: 8, discountTotal: 2500, refundTotal: 800, grossRevenue: 31000, daysWithData: 29 },
  { monthKey: '2025-11', monthLabel: '11月', monthLabelEn: 'Nov', orders: 680, revenue: 31200, avgOrderValue: 46, dailyOrders: 22, discountRate: 7.8, discountTotal: 2700, refundTotal: 750, grossRevenue: 33950, daysWithData: 28 },
  { monthKey: '2025-12', monthLabel: '12月', monthLabelEn: 'Dec', orders: 780, revenue: 35800, avgOrderValue: 46, dailyOrders: 25, discountRate: 9, discountTotal: 3500, refundTotal: 900, grossRevenue: 39300, daysWithData: 31 },
  { monthKey: '2026-01', monthLabel: '1月', monthLabelEn: 'Jan', orders: 720, revenue: 33400, avgOrderValue: 46, dailyOrders: 23, discountRate: 8.5, discountTotal: 3200, refundTotal: 820, grossRevenue: 36600, daysWithData: 29 },
  { monthKey: '2026-02', monthLabel: '2月', monthLabelEn: 'Feb', orders: 630, revenue: 29100, avgOrderValue: 46, dailyOrders: 22, discountRate: 7.5, discountTotal: 2400, refundTotal: 700, grossRevenue: 31500, daysWithData: 26 },
];

const FALLBACK_PLATFORM_DISTRIBUTION = [
  { label: 'UberEats', orders: 912, revenue: 42000, sharePct: 45 },
  { label: 'DoorDash', orders: 714, revenue: 33600, sharePct: 35 },
  { label: 'Dine-in', orders: 402, revenue: 19200, sharePct: 20 },
];

export function OperationalSnapshot({ snapshot }: { snapshot: DashboardInsightSnapshot }) {
  const { copy, lang } = useDashboardLanguage();
  const monthlyTrend = snapshot.monthlyTrend.length ? snapshot.monthlyTrend : FALLBACK_MONTHLY_TREND;
  const platformDistribution = snapshot.platformDistribution.length ? snapshot.platformDistribution : FALLBACK_PLATFORM_DISTRIBUTION;
  const maxRevenue = Math.max(...monthlyTrend.map((item) => item.revenue), 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-zinc-800/80">
        <div>
          <CardTitle className="text-base">{copy.dashboardInsights.title}</CardTitle>
          <p className="mt-1 text-sm text-zinc-400">{copy.dashboardInsights.description}</p>
        </div>
        <Badge className={sourceClass(snapshot.source)}>
          {copy.analysisSummary.sourceLabels[snapshot.source]}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        {snapshot.warning ? (
          <div className="flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{snapshot.warning}</div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-100">{copy.dashboardInsights.healthScore}</p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-4xl font-semibold text-zinc-100">{snapshot.healthScore}</span>
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300">
                    {snapshot.healthGrade}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(8, Math.min(100, snapshot.healthScore))}%` }}
              />
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                  {copy.dashboardInsights.healthIssue}
                </p>
                <p className="text-zinc-300">{snapshot.healthIssue}</p>
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                  {copy.dashboardInsights.healthStrength}
                </p>
                <p className="text-zinc-300">{snapshot.healthStrength}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-100">
              <ShieldAlert className="h-4 w-4 text-orange-300" />
              {copy.dashboardInsights.topRecommendation}
            </div>
            {snapshot.priorityRecommendation ? (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold text-zinc-100">
                    {lang === 'zh'
                      ? snapshot.priorityRecommendation.title_zh ?? snapshot.priorityRecommendation.title
                      : snapshot.priorityRecommendation.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {snapshot.priorityRecommendation.description}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <p className="text-xs text-zinc-500">{copy.dashboardInsights.recommendationImpact}</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-100">
                      {snapshot.priorityRecommendation.impact_score}/10
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <p className="text-xs text-zinc-500">{copy.dashboardInsights.recommendationConfidence}</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-100">
                      {snapshot.priorityRecommendation.confidence ?? '--'}%
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-300">
                  <p className="text-xs text-zinc-500">{copy.dashboardInsights.recommendationOutcome}</p>
                  <p className="mt-1 leading-6">{snapshot.priorityRecommendation.expected_outcome}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-orange-500/20 bg-orange-500/10 text-orange-200">
                    {snapshot.recommendationStats.total} {copy.dashboardPage.recommendedActions}
                  </Badge>
                  <Badge className="border-zinc-700 bg-zinc-900 text-zinc-200">
                    {snapshot.recommendationStats.humanReviewRequired > 0
                      ? copy.dashboardInsights.recommendationHumanReview
                      : copy.dashboardInsights.recommendationReady}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                {copy.dashboardInsights.noRecommendation}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="mb-4 text-sm font-medium text-zinc-100">{copy.dashboardInsights.monthlyTrend}</p>
            {monthlyTrend.length ? (
              <div className="overflow-x-auto">
                <div className="flex min-w-[640px] items-end gap-4">
                  {monthlyTrend.map((point) => (
                    <div key={point.monthKey} className="flex flex-1 flex-col gap-2">
                      <div className="h-44 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
                        <div className="flex h-full items-end justify-center">
                          <div
                            className="w-14 rounded-t-xl bg-orange-500/90 transition-all"
                            style={{ height: `${Math.max(12, (point.revenue / maxRevenue) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-zinc-500">{lang === 'zh' ? point.monthLabel : point.monthLabelEn}</p>
                        <p className="mt-1 text-sm font-medium text-zinc-100">
                          {new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
                            style: 'currency',
                            currency: 'USD',
                            notation: 'compact',
                            maximumFractionDigits: 1,
                          }).format(point.revenue)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {lang === 'zh' ? `日均 ${point.dailyOrders.toFixed(1)} 单` : `${point.dailyOrders.toFixed(1)} orders/day`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                --
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="mb-4 text-sm font-medium text-zinc-100">{copy.dashboardInsights.platformDistribution}</p>
            {platformDistribution.length ? (
              <div className="space-y-3">
                {platformDistribution.map((platform) => (
                  <div key={platform.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{platform.label}</span>
                      <span className="text-zinc-400">{platform.sharePct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{ width: `${Math.max(6, Math.min(100, platform.sharePct))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{platform.orders} {lang === 'zh' ? '单' : 'orders'}</span>
                      <span>
                        {new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
                          style: 'currency',
                          currency: 'USD',
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        }).format(platform.revenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                {copy.dashboardInsights.platformNoData}
              </div>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
