'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ExecutionLog } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function ExecutionLogPanel({ logs }: { logs: ExecutionLog[] }) {
  const { copy } = useDashboardLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.executionLogs.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">{copy.executionLogs.empty}</div>
        ) : logs.slice(0, 8).map((log) => (
          <div key={log.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-100">{log.recommendationTitle}</p>
              <span className={cn('text-xs capitalize', log.status === 'completed' ? 'text-emerald-400' : log.status === 'failed' ? 'text-red-400' : log.status === 'rolled_back' ? 'text-yellow-300' : 'text-orange-300')}>{log.status}</span>
            </div>
            <p className="text-xs text-zinc-500">{new Date(log.timestamp).toLocaleString()}</p>
            <p className="mt-1 text-sm text-zinc-400">{log.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
