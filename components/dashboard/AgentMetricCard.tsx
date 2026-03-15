import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import type { AgentMetric } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { DashboardLang } from '@/lib/dashboard-language';

export function AgentMetricCard({ metric, lang = 'zh' }: { metric: AgentMetric; lang?: DashboardLang }) {
  const TrendIcon = metric.trendDirection === 'up' ? TrendingUp : metric.trendDirection === 'down' ? TrendingDown : Minus;
  // Use English title when lang is 'en' and titleEn exists, otherwise use Chinese title
  const displayTitle = lang === 'en' && metric.titleEn ? metric.titleEn : metric.title;
  return (
    <Card className="bg-zinc-900/70">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{displayTitle}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{metric.value}</p>
          </div>
          <div className={cn('rounded-lg p-2', metric.trendDirection === 'down' ? 'bg-red-500/10 text-red-400' : metric.trendDirection === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400')}>
            <TrendIcon className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={cn(metric.trendDirection === 'down' ? 'text-red-400' : metric.trendDirection === 'up' ? 'text-emerald-400' : 'text-zinc-400')}>{metric.trend}</span>
          <span className="text-zinc-500">{metric.subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
}
