'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AgentMetricCard } from '@/components/dashboard/AgentMetricCard';
import { OperationalSnapshot } from '@/components/dashboard/OperationalSnapshot';
import { RecommendationCard } from '@/components/dashboard/RecommendationCard';
import { ExecutionLogPanel } from '@/components/dashboard/ExecutionLogPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { dashboardMetrics, executionLogsMock, mockAnalysisResponse } from '@/lib/mock-data';
import { useExecution } from '@/hooks/useExecution';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import {
  deriveDashboardInsightSnapshot,
  deriveDashboardMetrics,
  fetchAnalysisRuntimeState,
  getDashboardAnalysis,
  saveAnalysisRuntimeState,
} from '@/lib/client/analysis-runtime';
import type { AnalysisResponse, AgentMetric, UploadedOpsDocument } from '@/lib/types';
import type { DashboardInsightSnapshot } from '@/lib/client/analysis-runtime';

export function DashboardClient() {
  const { copy, lang } = useDashboardLanguage();
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());
  const { tasks, logs, execute, rollback } = useExecution(executionLogsMock);
  const toast = useToast();
  const [dashboardAnalysis, setDashboardAnalysis] = useState<AnalysisResponse>(mockAnalysisResponse);
  const [metrics, setMetrics] = useState<AgentMetric[]>(dashboardMetrics);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedOpsDocument[]>([]);
  const [snapshot, setSnapshot] = useState<DashboardInsightSnapshot>(getDashboardAnalysis(lang).snapshot);
  const [dailyBriefing, setDailyBriefing] = useState<string>('');
  const [dailyBriefingSource, setDailyBriefingSource] = useState<'live' | 'fallback'>('fallback');
  const [dailyBriefingWarning, setDailyBriefingWarning] = useState<string | undefined>();
  const [dailyBriefingProvider, setDailyBriefingProvider] = useState<'nova' | 'openai' | 'deterministic' | undefined>();

  useEffect(() => {
    let disposed = false;

    async function loadDashboardRuntime() {
      const remoteRuntime = await fetchAnalysisRuntimeState();
      if (remoteRuntime && !disposed) {
        setDashboardAnalysis(remoteRuntime.analysis);
        setMetrics(
          deriveDashboardMetrics(lang, remoteRuntime.analysis, remoteRuntime.updatedAt, remoteRuntime.uploadedDocuments)
        );
        setUploadedDocuments(remoteRuntime.uploadedDocuments);
        setSnapshot(deriveDashboardInsightSnapshot(remoteRuntime.analysis));
        saveAnalysisRuntimeState(remoteRuntime);
        return;
      }

      const runtime = getDashboardAnalysis(lang);
      if (disposed) return;
      setDashboardAnalysis(runtime.analysis);
      setMetrics(runtime.metrics);
      setUploadedDocuments(runtime.uploadedDocuments);
      setSnapshot(runtime.snapshot);
    }

    void loadDashboardRuntime();
    return () => {
      disposed = true;
    };
  }, [lang, lastRefresh]);

  useEffect(() => {
    let disposed = false;

    async function loadDailyBriefing() {
      try {
        const response = await fetch(`/api/dashboard/daily-briefing?lang=${lang}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || disposed) return;
        setDailyBriefing(typeof payload.briefing === 'string' ? payload.briefing : '');
        setDailyBriefingSource(payload.source === 'live' ? 'live' : 'fallback');
        if (payload.provider === 'nova' || payload.provider === 'openai' || payload.provider === 'deterministic') {
          setDailyBriefingProvider(payload.provider);
        } else {
          setDailyBriefingProvider(undefined);
        }
        setDailyBriefingWarning(
          typeof payload.warning === 'string' && payload.warning ? payload.warning : undefined
        );
      } catch {
        if (disposed) return;
        setDailyBriefing('');
        setDailyBriefingSource('fallback');
        setDailyBriefingProvider(undefined);
        setDailyBriefingWarning(
          lang === 'zh'
            ? '每日简报接口暂不可用，已使用本地信息。'
            : 'Daily briefing endpoint is unavailable. Using local context.'
        );
      }
    }

    void loadDailyBriefing();
    return () => {
      disposed = true;
    };
  }, [lang, lastRefresh]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.dashboardPage.title}
        description={copy.dashboardPage.description}
        badge={copy.dashboardPage.badge}
        actions={(
          <>
            <Badge className="border-zinc-700 bg-zinc-900 text-zinc-300">{copy.dashboardPage.updatedPrefix} {new Date(lastRefresh).toLocaleTimeString()}</Badge>
            <Button variant="secondary" onClick={() => { setLastRefresh(Date.now()); toast.success(copy.dashboardPage.refreshToast); }}>
              <RefreshCw className="h-4 w-4" /> {copy.dashboardPage.refresh}
            </Button>
          </>
        )}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/80">
          <div>
            <CardTitle className="text-base">
              {lang === 'zh' ? '智能日报' : 'Daily Briefing'}
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              {lang === 'zh'
                ? dailyBriefingSource === 'live'
                  ? '基于当前经营数据和建议自动生成'
                  : '使用确定性摘要（无 LLM 或调用失败时自动回退）'
                : dailyBriefingSource === 'live'
                  ? 'Auto-generated from current operating data and recommendations'
                  : 'Deterministic fallback summary (used when LLM is unavailable)'}
            </p>
          </div>
          <Badge
            className={
              dailyBriefingSource === 'live'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
            }
          >
            {dailyBriefingSource === 'live'
              ? lang === 'zh'
                ? '实时生成'
                : 'Live'
              : lang === 'zh'
                ? '回退摘要'
                : 'Fallback'}
          </Badge>
          {dailyBriefingProvider ? (
            <Badge className="ml-2 border-sky-500/30 bg-sky-500/10 text-sky-200">
              {dailyBriefingProvider === 'nova'
                ? (lang === 'zh' ? 'Amazon Nova' : 'Amazon Nova')
                : dailyBriefingProvider === 'openai'
                  ? (lang === 'zh' ? 'OpenAI 次级提供' : 'OpenAI (secondary)')
                  : (lang === 'zh' ? '确定性摘要' : 'Deterministic')}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {dailyBriefing ? (
            <pre className="whitespace-pre-wrap break-words rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm leading-6 text-zinc-200">
              {dailyBriefing}
            </pre>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
              {lang === 'zh' ? '简报生成中，请稍后刷新。' : 'Briefing is being prepared. Refresh shortly.'}
            </div>
          )}
          {dailyBriefingWarning ? (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200">
              {dailyBriefingWarning}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <AgentMetricCard key={metric.id} metric={metric} lang={lang} />)}
      </div>

      <OperationalSnapshot snapshot={snapshot} />

      {uploadedDocuments.length ? null : (
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardContent className="flex flex-col gap-2 p-4 text-sm text-zinc-300 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">
                {lang === 'zh'
                  ? '当前总览仍以系统默认分析样例展示'
                  : 'Dashboard is still showing the default analysis sample'}
              </div>
              <div className="text-xs text-zinc-500">
                {lang === 'zh'
                  ? '先到 Analysis 上传运营数据并提交分析，总览会自动切换为解析后的真实经营指标和建议。'
                  : 'Upload operating data in Analysis and submit a run to replace this with parsed metrics and recommendations.'}
              </div>
            </div>
            <Button variant="secondary" onClick={() => { setLastRefresh(Date.now()); toast.success(copy.dashboardPage.refreshToast); }}>
              <RefreshCw className="h-4 w-4" /> {lang === 'zh' ? '重新读取分析结果' : 'Reload analysis'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{copy.dashboardPage.recommendedActions}</CardTitle>
              <p className="mt-1 text-sm text-zinc-400">{copy.dashboardPage.recommendedDesc}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => toast.info(copy.dashboardPage.openAnalysisToast)}>{copy.dashboardPage.openAnalysis}</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardAnalysis.recommendations.slice(0, 3).map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                task={tasks[rec.id]}
                onExecute={async (item) => { await execute(item); toast.success(`${copy.analysisPage.executeToastPrefix}${item.title}`); }}
                onRollback={async (item) => { await rollback(item); toast.warning(`${copy.analysisPage.rollbackToastPrefix}${item.title}`); }}
                compact
              />
            ))}
          </CardContent>
        </Card>
        <ExecutionLogPanel logs={logs} />
      </div>
    </div>
  );
}
