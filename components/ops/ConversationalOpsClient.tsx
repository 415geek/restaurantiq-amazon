'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type {
  ConversationalOpsCommand,
  OpsActorRole,
  OpsCommandAction,
  OpsCommandStatus,
} from '@/lib/ops-copilot-types';

const STATUS_ORDER: OpsCommandStatus[] = [
  'draft',
  'parsed',
  'awaiting_confirmation',
  'awaiting_approval',
  'scheduled',
  'executing',
  'synced',
  'partially_failed',
  'completed',
  'rolled_back',
  'failed',
  'rejected',
];

const STATUS_TONE: Record<OpsCommandStatus, string> = {
  draft: 'border-zinc-700 bg-zinc-900/70 text-zinc-300',
  parsed: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  awaiting_confirmation: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  awaiting_approval: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  scheduled: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  executing: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  synced: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  partially_failed: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rolled_back: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
  rejected: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const TEMPLATE_COMMANDS = {
  zh: [
    '帮我把海南鸡饭明天打 8 折',
    '把 Sunset 店周末晚上 6-9 点的炸鸡套餐价格提高 1 美元',
    '下架 Uber Eats 上评分低于 4.2 的两个 SKU 三天',
    '把所有门店的午餐 special 下周一自动恢复原价',
    '先预览，不要立刻发布',
  ],
  en: [
    'Discount Hainan chicken rice by 20% tomorrow',
    'Increase the fried chicken combo by $1 at Sunset store during dinner rush',
    'Unlist the lowest-rated two SKUs on Uber Eats for 3 days',
    'Restore lunch specials to original prices next Monday',
    'Preview first and do not publish yet',
  ],
};

function localCopy(lang: 'zh' | 'en') {
  if (lang === 'zh') {
    return {
      title: '对话式经营执行',
      description:
        '像聊天一样下达经营指令，但执行前必须经过结构化预览、审批与回滚保护。',
      badge: 'Conversational Ops',
      inputLabel: '输入经营指令',
      actorRole: '执行角色',
      submit: '解析指令',
      parsing: '解析中…',
      empty: '还没有指令。先输入一条经营动作，系统会生成执行预览。',
      timeline: '状态机',
      preview: '执行前预览',
      affected: '影响范围',
      changes: '变更明细',
      risk: '风险与护栏',
      audit: '审计日志',
      results: '多平台同步结果',
      missing: '参数缺失',
      warnings: '提示',
      scheduleAt: '计划生效时间',
      restoreAt: '自动恢复时间',
      updateSchedule: '更新定时',
      actionConfirm: '确认',
      actionApprove: '审批通过',
      actionExecute: '立即执行',
      actionRollback: '回滚',
      actionReject: '驳回',
      actionSchedule: '设为定时',
      created: '指令已解析，进入预览环节。',
      actionDone: '状态已更新。',
      loadFailed: '加载指令失败',
      roleOwner: '店主',
      roleManager: '经理',
      roleStaff: '员工',
      roleInternal: '内部',
    };
  }
  return {
    title: 'Conversational Ops Execution',
    description:
      'Issue natural-language operations commands with enterprise controls: preview, approval, rollback, and audit.',
    badge: 'Conversational Ops',
    inputLabel: 'Enter command',
    actorRole: 'Actor role',
    submit: 'Parse command',
    parsing: 'Parsing…',
    empty: 'No commands yet. Submit an instruction to generate a structured execution preview.',
    timeline: 'State machine',
    preview: 'Execution preview',
    affected: 'Scope',
    changes: 'Change set',
    risk: 'Risk & guardrails',
    audit: 'Audit log',
    results: 'Multi-platform sync results',
    missing: 'Missing parameters',
    warnings: 'Warnings',
    scheduleAt: 'Effective time',
    restoreAt: 'Auto-restore time',
    updateSchedule: 'Update schedule',
    actionConfirm: 'Confirm',
    actionApprove: 'Approve',
    actionExecute: 'Execute now',
    actionRollback: 'Rollback',
    actionReject: 'Reject',
    actionSchedule: 'Schedule',
    created: 'Command parsed. Review the preview before execution.',
    actionDone: 'Command state updated.',
    loadFailed: 'Failed to load commands',
    roleOwner: 'Owner',
    roleManager: 'Manager',
    roleStaff: 'Staff',
    roleInternal: 'Internal',
  };
}

function formatValue(value: unknown) {
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '-';
  return String(value);
}

export function ConversationalOpsClient() {
  const { lang } = useDashboardLanguage();
  const text = localCopy(lang);
  const toast = useToast();
  const [commandInput, setCommandInput] = useState('');
  const [actorRole, setActorRole] = useState<OpsActorRole>('manager');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commands, setCommands] = useState<ConversationalOpsCommand[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [restoreAt, setRestoreAt] = useState('');
  const [pendingAction, setPendingAction] = useState<OpsCommandAction | null>(null);

  const selected = useMemo(
    () => commands.find((command) => command.id === selectedId) ?? null,
    [commands, selectedId]
  );

  const loadCommands = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ops/commands', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'load_failed');
      const nextCommands = (payload.commands ?? []) as ConversationalOpsCommand[];
      setCommands(nextCommands);
      setSelectedId((prev) => prev || nextCommands[0]?.id || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [toast, text.loadFailed]);

  useEffect(() => {
    void loadCommands();
  }, [loadCommands]);

  useEffect(() => {
    if (!selected) return;
    setScheduleAt(selected.scheduledAt ? selected.scheduledAt.slice(0, 16) : '');
    setRestoreAt(selected.autoRestoreAt ? selected.autoRestoreAt.slice(0, 16) : '');
  }, [selected]);

  const createCommand = async () => {
    if (!commandInput.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/ops/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandInput.trim(),
          actorRole,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'create_failed');
      const command = payload.command as ConversationalOpsCommand;
      setCommands((prev) => [command, ...prev].slice(0, 120));
      setSelectedId(command.id);
      setCommandInput('');
      toast.success(text.created);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'create_failed');
    } finally {
      setSubmitting(false);
    }
  };

  const mutateCommand = async (action: OpsCommandAction, extra?: Record<string, unknown>) => {
    if (!selected) return;
    setPendingAction(action);
    try {
      const response = await fetch(`/api/ops/commands/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          actorRole,
          ...extra,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'action_failed');
      const next = payload.command as ConversationalOpsCommand;
      setCommands((prev) => prev.map((item) => (item.id === next.id ? next : item)));
      toast.success(text.actionDone);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'action_failed');
    } finally {
      setPendingAction(null);
    }
  };

  const canConfirm = selected && ['awaiting_confirmation', 'parsed'].includes(selected.status);
  const canApprove = selected && selected.status === 'awaiting_approval';
  const canExecute =
    selected &&
    ['parsed', 'awaiting_confirmation', 'awaiting_approval', 'scheduled'].includes(selected.status);
  const canRollback =
    selected &&
    Boolean(selected.rollbackDeadline && Date.parse(selected.rollbackDeadline) > Date.now()) &&
    ['completed', 'partially_failed'].includes(selected.status);
  const canSchedule = selected && ['awaiting_confirmation', 'awaiting_approval', 'parsed'].includes(selected.status);
  const canReject = selected && ['awaiting_confirmation', 'awaiting_approval', 'parsed'].includes(selected.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={text.title}
        description={text.description}
        badge={text.badge}
      />

      <Card>
        <CardHeader className="border-b border-zinc-800/80">
          <CardTitle className="text-base">{text.inputLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
            <Input
              value={commandInput}
              onChange={(event) => setCommandInput(event.target.value)}
              placeholder={lang === 'zh' ? '例如：帮我把海南鸡饭明天打 8 折' : 'Example: discount Hainan chicken rice by 20% tomorrow'}
            />
            <select
              value={actorRole}
              onChange={(event) => setActorRole(event.target.value as OpsActorRole)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="owner">{text.roleOwner}</option>
              <option value="manager">{text.roleManager}</option>
              <option value="staff">{text.roleStaff}</option>
              <option value="internal">{text.roleInternal}</option>
            </select>
            <Button onClick={() => void createCommand()} disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? text.parsing : text.submit}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_COMMANDS[lang].map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setCommandInput(template)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700"
              >
                <Sparkles className="mr-1 inline h-3 w-3" />
                {template}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <Card>
          <CardHeader className="border-b border-zinc-800/80">
            <CardTitle className="text-base">{lang === 'zh' ? '指令队列' : 'Command Queue'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                Loading…
              </div>
            ) : commands.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                {text.empty}
              </div>
            ) : (
              commands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => setSelectedId(command.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedId === command.id
                      ? 'border-orange-500/40 bg-orange-500/10'
                      : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-zinc-100">{command.sourceText}</div>
                    <Badge className={STATUS_TONE[command.status]}>{command.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>{command.actionType}</span>
                    <span>risk:{command.riskLevel}</span>
                    <span>{new Date(command.updatedAt).toLocaleString()}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <>
              <Card>
                <CardHeader className="border-b border-zinc-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{text.preview}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={STATUS_TONE[selected.status]}>{selected.status}</Badge>
                      <Badge className="border-zinc-700 bg-zinc-900/60 text-zinc-300">
                        confidence {(selected.confidence * 100).toFixed(0)}%
                      </Badge>
                      {selected.retryQueueSize ? (
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                          {lang === 'zh' ? `重试队列 ${selected.retryQueueSize}` : `Retry queue ${selected.retryQueueSize}`}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="text-xs text-zinc-500">{lang === 'zh' ? '规范化意图' : 'Normalized intent'}</div>
                    <div className="mt-1 text-sm text-zinc-200">{selected.normalizedIntent}</div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-medium text-zinc-200">{text.affected}</div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
                        <div className="text-zinc-500">{lang === 'zh' ? '门店' : 'Stores'}</div>
                        <div className="mt-1 text-zinc-100">{selected.preview.affectedStores.join(', ') || '-'}</div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
                        <div className="text-zinc-500">{lang === 'zh' ? '平台' : 'Platforms'}</div>
                        <div className="mt-1 text-zinc-100">{selected.preview.affectedPlatforms.join(', ') || '-'}</div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
                        <div className="text-zinc-500">{lang === 'zh' ? '菜品' : 'Items'}</div>
                        <div className="mt-1 text-zinc-100">
                          {selected.preview.affectedItems.map((item) => item.name).join(', ') || '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-medium text-zinc-200">{text.changes}</div>
                    <div className="overflow-x-auto rounded-xl border border-zinc-800">
                      <table className="min-w-full text-xs">
                        <thead className="bg-zinc-900/80 text-zinc-400">
                          <tr>
                            <th className="px-3 py-2 text-left">{lang === 'zh' ? '菜品' : 'Item'}</th>
                            <th className="px-3 py-2 text-left">{lang === 'zh' ? '平台' : 'Platform'}</th>
                            <th className="px-3 py-2 text-left">{lang === 'zh' ? '字段' : 'Field'}</th>
                            <th className="px-3 py-2 text-left">{lang === 'zh' ? '旧值' : 'Old'}</th>
                            <th className="px-3 py-2 text-left">{lang === 'zh' ? '新值' : 'New'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800 text-zinc-200">
                          {selected.preview.changes.length ? (
                            selected.preview.changes.map((change, index) => (
                              <tr key={`${change.itemId || 'na'}-${change.platform}-${index}`}>
                                <td className="px-3 py-2">{change.itemName}</td>
                                <td className="px-3 py-2">{change.platform}</td>
                                <td className="px-3 py-2">{change.field}</td>
                                <td className="px-3 py-2">{formatValue(change.oldValue)}</td>
                                <td className="px-3 py-2">{formatValue(change.newValue)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-3 py-3 text-zinc-400">
                                {lang === 'zh' ? '暂无可执行变更，可能需要补充参数。' : 'No concrete changes yet. Additional parameters may be required.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-300">
                      <div className="mb-1 font-medium text-zinc-200">{text.risk}</div>
                      <div className="space-y-1">
                        {selected.preview.riskNotes.length ? (
                          selected.preview.riskNotes.map((note) => (
                            <div key={note} className="flex items-start gap-1">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-yellow-400" />
                              <span>{note}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-zinc-500">-</div>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className="text-zinc-500">{text.scheduleAt}: </span>
                        <span>{selected.preview.effectiveAt ? new Date(selected.preview.effectiveAt).toLocaleString() : '-'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">{text.restoreAt}: </span>
                        <span>{selected.preview.autoRestoreAt ? new Date(selected.preview.autoRestoreAt).toLocaleString() : '-'}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-300">
                      <div className="mb-1 font-medium text-zinc-200">{text.timeline}</div>
                      <div className="space-y-1">
                        {STATUS_ORDER.map((status) => {
                          const active = status === selected.status;
                          const completed = STATUS_ORDER.indexOf(status) <= STATUS_ORDER.indexOf(selected.status);
                          return (
                            <div
                              key={status}
                              className={`flex items-center gap-2 rounded-md px-2 py-1 ${
                                active
                                  ? 'bg-orange-500/15 text-orange-200'
                                  : completed
                                    ? 'text-zinc-200'
                                    : 'text-zinc-500'
                              }`}
                            >
                              {active ? <Clock3 className="h-3.5 w-3.5" /> : completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              <span>{status}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {selected.missingParams.length ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200">
                      <div className="mb-1 font-medium">{text.missing}</div>
                      {selected.missingParams.join(', ')}
                    </div>
                  ) : null}
                  {selected.warnings.length ? (
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200">
                      <div className="mb-1 font-medium">{text.warnings}</div>
                      {selected.warnings.join(' | ')}
                    </div>
                  ) : null}

                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(event) => setScheduleAt(event.target.value)}
                    />
                    <Input
                      type="datetime-local"
                      value={restoreAt}
                      onChange={(event) => setRestoreAt(event.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={!canSchedule || pendingAction !== null || !scheduleAt}
                      onClick={() =>
                        void mutateCommand('schedule', {
                          scheduledAt: new Date(scheduleAt).toISOString(),
                          autoRestoreAt: restoreAt ? new Date(restoreAt).toISOString() : undefined,
                        })
                      }
                    >
                      <Clock3 className="h-4 w-4" />
                      {text.actionSchedule}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!canConfirm || pendingAction !== null}
                      onClick={() => void mutateCommand('confirm')}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {text.actionConfirm}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!canApprove || pendingAction !== null}
                      onClick={() => void mutateCommand('approve')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {text.actionApprove}
                    </Button>
                    <Button
                      disabled={!canExecute || pendingAction !== null}
                      onClick={() => void mutateCommand('execute')}
                    >
                      <Play className="h-4 w-4" />
                      {text.actionExecute}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={!canRollback || pendingAction !== null}
                      onClick={() => void mutateCommand('rollback')}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {text.actionRollback}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!canReject || pendingAction !== null}
                      onClick={() => void mutateCommand('reject')}
                    >
                      <XCircle className="h-4 w-4" />
                      {text.actionReject}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader className="border-b border-zinc-800/80">
                    <CardTitle className="text-base">{text.results}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selected.platformResults.length ? (
                      selected.platformResults.map((result) => (
                        <div
                          key={`${result.platform}-${result.syncedAt}`}
                          className={`rounded-xl border p-3 ${
                            result.success
                              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
                              : 'border-red-500/20 bg-red-500/5 text-red-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{result.platform}</span>
                            <span>{result.success ? 'OK' : result.retryable ? 'RETRY' : 'FAIL'}</span>
                          </div>
                          <div className="mt-1 text-xs">{result.message}</div>
                          {typeof result.attempts === 'number' ? (
                            <div className="mt-1 text-[11px] opacity-85">
                              {lang === 'zh' ? '重试次数' : 'Attempts'}: {result.attempts}
                            </div>
                          ) : null}
                          {result.nextRetryAt ? (
                            <div className="mt-1 text-[11px] opacity-85">
                              {lang === 'zh' ? '下次重试' : 'Next retry'}: {new Date(result.nextRetryAt).toLocaleString()}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-400">
                        {lang === 'zh' ? '尚未执行跨平台同步。' : 'No platform sync has run yet.'}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b border-zinc-800/80">
                    <CardTitle className="text-base">{text.audit}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selected.auditTrail.map((audit) => (
                      <div key={audit.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span>{audit.action}</span>
                          <span>{new Date(audit.at).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-zinc-200">
                          {audit.fromStatus ? `${audit.fromStatus} -> ${audit.toStatus}` : audit.toStatus}
                        </div>
                        {audit.note ? <div className="mt-1 text-xs text-zinc-400">{audit.note}</div> : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-zinc-400">{text.empty}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
