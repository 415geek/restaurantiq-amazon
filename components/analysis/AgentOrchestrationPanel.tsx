'use client';

import { BrainCircuit, Database, Globe2, Radar, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { AgentOutput, AgentRun, AnalysisOrchestrationResult } from '@/lib/types';

type Props = {
  orchestration?: AnalysisOrchestrationResult;
  lang: 'zh' | 'en';
};

const AGENT_META = {
  A: {
    icon: Database,
    label: { zh: 'Agent A · 数据解析器', en: 'Agent A · Data Parser' },
    description: {
      zh: '负责解析、清洗、归一化上传的运营数据，并输出结构化经营指标。',
      en: 'Parses, cleans, and normalizes uploaded operating data into structured business metrics.',
    },
  },
  B: {
    icon: Radar,
    label: { zh: 'Agent B · 数据分析器', en: 'Agent B · Analytics Engine' },
    description: {
      zh: '负责基于解析后的经营数据计算健康度、关键问题、机会点与平台洞察。',
      en: 'Turns parsed operating data into health scores, core issues, opportunities, and platform insights.',
    },
  },
  C: {
    icon: Globe2,
    label: { zh: 'Agent C · 策略规划器', en: 'Agent C · Strategy Planner' },
    description: {
      zh: '负责把分析结论转成任务板、实验计划、数据请求和两周执行节奏。',
      en: 'Converts analysis into a task board, experiments, data requests, and a two-week operating plan.',
    },
  },
  D: {
    icon: BrainCircuit,
    label: { zh: 'Agent D · 输出验证器', en: 'Agent D · Output Validator' },
    description: {
      zh: '负责校验、修正并收口最终任务计划，输出前端直接可消费的稳定结构。',
      en: 'Validates, repairs, and finalizes the plan into a stable frontend-ready output.',
    },
  },
} as const;

const RUN_STATUS_LABELS = {
  zh: {
    completed: '已完成',
    partial: '部分完成',
    failed: '失败',
    running: '运行中',
    pending: '等待中',
    unknown: '未知',
  },
  en: {
    completed: 'completed',
    partial: 'partial',
    failed: 'failed',
    running: 'running',
    pending: 'pending',
    unknown: 'unknown',
  },
} as const;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, 4)
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join(' / ');
  }
  return JSON.stringify(value);
}

function extractPreviewEntries(payload: Record<string, unknown>) {
  return Object.entries(payload).slice(0, 6);
}

function findRun(agentRuns: AgentRun[], agent: AgentOutput['agent']) {
  return agentRuns.find((run) => run.agent === agent);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function AgentOrchestrationPanel({ orchestration, lang }: Props) {
  if (!orchestration?.agentOutputs?.length) return null;

  const outputs = orchestration.agentOutputs.filter((output) => output.agent !== undefined);
  const orchestrationStatus =
    RUN_STATUS_LABELS[lang][orchestration.status as keyof typeof RUN_STATUS_LABELS.en] ??
    orchestration.status;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">
            {lang === 'zh' ? '多 Agent 编排输出' : 'Multi-Agent Orchestration Outputs'}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {lang === 'zh'
              ? '展示 Parser / Analyzer / Planner / Validator 四段链路的结构化输出、运行状态与证据引用。'
              : 'Shows the structured outputs, run status, and evidence references for the Parser / Analyzer / Planner / Validator chain.'}
          </p>
        </div>
        <div className="rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-300">
          {lang === 'zh' ? `运行状态：${orchestrationStatus}` : `Run status: ${orchestrationStatus}`}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {outputs.map((output) => {
          const meta = AGENT_META[output.agent];
          const Icon = meta.icon;
          const run = findRun(orchestration.agentRuns, output.agent);
          const previewEntries = extractPreviewEntries(output.structuredPayload);
          const aggregatedMetrics = isRecord(output.structuredPayload.aggregatedMetrics)
            ? output.structuredPayload.aggregatedMetrics
            : null;
          const normalizedDatasets = Array.isArray(output.structuredPayload.normalizedDatasets)
            ? output.structuredPayload.normalizedDatasets.filter(isRecord)
            : [];
          const runStatus =
            RUN_STATUS_LABELS[lang][(run?.status ?? 'unknown') as keyof typeof RUN_STATUS_LABELS.en] ??
            (run?.status ?? 'unknown');
          return (
            <Card key={output.agent} className="border-zinc-800 bg-zinc-950/70">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-2 text-orange-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-zinc-50">{meta.label[lang]}</CardTitle>
                      <p className="mt-1 text-sm text-zinc-400">{meta.description[lang]}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-xs">
                    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-zinc-300">
                      {lang === 'zh' ? `置信度 ${(output.confidence * 100).toFixed(0)}%` : `Confidence ${(output.confidence * 100).toFixed(0)}%`}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 ${
                        run?.status === 'failed'
                          ? 'border border-red-500/30 bg-red-500/10 text-red-300'
                          : run?.status === 'partial'
                            ? 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                            : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {lang === 'zh' ? `状态 ${runStatus}` : `Status ${runStatus}`}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300">
                  {output.summary}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricChip
                    label={lang === 'zh' ? '证据引用' : 'Evidence refs'}
                    value={String(output.evidenceRefs.length)}
                  />
                  <MetricChip
                    label={lang === 'zh' ? '运行输入' : 'Input summary'}
                    value={run?.inputSummary ?? '-'}
                  />
                  <MetricChip
                    label={lang === 'zh' ? '运行输出' : 'Output summary'}
                    value={run?.outputSummary ?? '-'}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <ShieldCheck className="h-4 w-4 text-orange-300" />
                    {lang === 'zh' ? '结构化输出预览' : 'Structured payload preview'}
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="grid gap-2">
                      {previewEntries.map(([key, value]) => (
                        <div key={key} className="grid gap-1 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 md:grid-cols-[160px_1fr]">
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{key}</div>
                          <div className="text-sm text-zinc-200">{formatValue(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {output.agent === 'A' && (aggregatedMetrics || normalizedDatasets.length) ? (
                  <div className="space-y-3">
                    {aggregatedMetrics ? (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                        <div className="mb-2 text-sm font-medium text-zinc-200">
                          {lang === 'zh' ? 'Agent A 聚合经营指标' : 'Agent A aggregated operating metrics'}
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {Object.entries(aggregatedMetrics)
                            .slice(0, 6)
                            .map(([key, value]) => (
                              <div key={key} className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 text-sm text-zinc-200">
                                <span className="text-zinc-500">{key}</span>: {formatValue(value)}
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}

                    {normalizedDatasets.length ? (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                        <div className="mb-2 text-sm font-medium text-zinc-200">
                          {lang === 'zh' ? 'Agent A 数据集解析摘要' : 'Agent A dataset parsing summary'}
                        </div>
                        <div className="space-y-2">
                          {normalizedDatasets.slice(0, 4).map((dataset, index) => (
                            <div key={`${String(dataset.fileName)}-${index}`} className="rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 text-sm text-zinc-200">
                              <div className="font-medium text-zinc-100">{String(dataset.fileName ?? `dataset-${index + 1}`)}</div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {String(dataset.category ?? 'unknown')} · {String(dataset.format ?? 'unknown')} · {String(dataset.rowCount ?? 0)} rows ·{' '}
                                {(Number(dataset.parserConfidence ?? 0) * 100).toFixed(0)}%
                              </div>
                              {Array.isArray(dataset.datasetHints) && dataset.datasetHints.length ? (
                                <div className="mt-2 text-xs text-emerald-300">{dataset.datasetHints.slice(0, 4).join(', ')}</div>
                              ) : null}
                              {Array.isArray(dataset.qualityFlags) && dataset.qualityFlags.length ? (
                                <div className="mt-1 text-xs text-yellow-300">{dataset.qualityFlags.slice(0, 3).join(', ')}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {output.warnings?.length ? (
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-200">
                    <div className="mb-2 font-medium">{lang === 'zh' ? '运行警告' : 'Warnings'}</div>
                    <ul className="space-y-1">
                      {output.warnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-sm text-zinc-100">{value}</div>
    </div>
  );
}
