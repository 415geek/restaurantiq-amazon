'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { AnalysisSummary as TAnalysisSummary, AgentSignal } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import { ContentTranslator } from '@/components/ui/ContentTranslator';

export function AnalysisSummary({ summary, signals, source, warning }: { summary: TAnalysisSummary; signals: AgentSignal[]; source: 'mock' | 'live' | 'fallback'; warning?: string }) {
  const { copy, lang } = useDashboardLanguage();
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-zinc-800/80">
        <div>
          <CardTitle className="text-base">{copy.analysisSummary.title}</CardTitle>
          <p className="mt-1 text-sm text-zinc-400">{copy.analysisSummary.description}</p>
        </div>
        <Badge className={source === 'live' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : source === 'fallback' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' : 'border-orange-500/30 bg-orange-500/10 text-orange-300'}>{copy.analysisSummary.sourceLabels[source]}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          {lang === 'en' ? (
            <ContentTranslator originalContent={summary.headline} contentType="analysis" autoTranslate className="[&_.text-sm]:font-medium [&_.text-sm]:text-zinc-100" />
          ) : (
            <p className="text-sm font-medium text-zinc-100">{summary.headline}</p>
          )}
          {lang === 'en' ? (
            <ContentTranslator originalContent={summary.insight} contentType="analysis" autoTranslate className="mt-2 [&_.text-sm]:text-zinc-400" />
          ) : (
            <p className="mt-2 text-sm text-zinc-400">{summary.insight}</p>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {signals.map((signal) => (
            <div key={signal.agent} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Agent {signal.agent}</span>
                <span className="text-[11px] text-zinc-500">{signal.status}</span>
              </div>
              {lang === 'en' ? (
                <ContentTranslator originalContent={signal.title} contentType="analysis" autoTranslate className="[&_.text-sm]:text-zinc-100" />
              ) : (
                <p className="text-sm text-zinc-100">{signal.title}</p>
              )}
              {lang === 'en' ? (
                <ContentTranslator originalContent={signal.summary} contentType="analysis" autoTranslate className="mt-1 [&_.text-sm]:text-xs [&_.text-sm]:text-zinc-400" />
              ) : (
                <p className="mt-1 text-xs text-zinc-400">{signal.summary}</p>
              )}
            </div>
          ))}
        </div>
        {(summary.riskNotice || warning) ? (
          <div className="flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{warning || summary.riskNotice || copy.analysisSummary.fallbackWarning}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
