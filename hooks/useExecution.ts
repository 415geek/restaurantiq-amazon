'use client';

import { useEffect, useRef, useState } from 'react';
import { executeRecommendation, rollbackRecommendation } from '@/lib/api/execute';
import type { ExecutionLog, ExecutionTask, Recommendation } from '@/lib/types';

export function useExecution(initialLogs: ExecutionLog[] = []) {
  const [tasks, setTasks] = useState<Record<string, ExecutionTask>>({});
  const [logs, setLogs] = useState<ExecutionLog[]>(initialLogs);
  const timers = useRef<Record<string, number[]>>({});

  useEffect(() => {
    return () => {
      Object.values(timers.current).flat().forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const execute = async (rec: Recommendation) => {
    const existing = tasks[rec.id];
    if (existing && ['pending', 'executing'].includes(existing.status)) return existing;

    const startedAt = Date.now();
    const apiRes = await executeRecommendation(rec.id, rec.execution_params);
    const rollbackDeadline = apiRes.rollback_deadline ? new Date(apiRes.rollback_deadline).getTime() : undefined;

    const task: ExecutionTask = {
      taskId: apiRes.task_id,
      recommendationId: rec.id,
      status: 'pending',
      startedAt,
      rollbackDeadline,
      result: apiRes.result,
    };

    setTasks((prev) => ({ ...prev, [rec.id]: task }));
    setLogs((prev) => [
      { id: `log-${Date.now()}`, recommendationTitle: rec.title, status: 'executing', timestamp: new Date().toISOString(), detail: 'Execution queued. Waiting for worker allocation.' },
      ...prev,
    ]);

    const toExecuting = window.setTimeout(() => {
      setTasks((prev) => prev[rec.id] ? { ...prev, [rec.id]: { ...prev[rec.id], status: 'executing' } } : prev);
    }, 1100);

    const toCompleted = window.setTimeout(() => {
      setTasks((prev) => prev[rec.id] ? {
        ...prev,
        [rec.id]: {
          ...prev[rec.id],
          status: rec.risk_level === 'high' && Math.random() < 0.15 ? 'failed' : 'completed',
          result: rec.risk_level === 'high' && Math.random() < 0.15 ? undefined : 'Mock execution completed successfully.',
          error: undefined,
        }
      } : prev);
      setLogs((prev) => [
        {
          id: `log-${Date.now() + 1}`,
          recommendationTitle: rec.title,
          status: 'completed',
          timestamp: new Date().toISOString(),
          detail: 'Changes pushed to connected channels. Rollback available during window.',
        },
        ...prev,
      ]);
    }, 3200);

    timers.current[rec.id] = [toExecuting, toCompleted];
    return task;
  };

  const rollback = async (rec: Recommendation) => {
    const task = tasks[rec.id];
    if (!task) return;
    await rollbackRecommendation(task.taskId);
    setTasks((prev) => ({ ...prev, [rec.id]: { ...task, status: 'rolled_back' } }));
    setLogs((prev) => [
      { id: `log-${Date.now()}`, recommendationTitle: rec.title, status: 'rolled_back', timestamp: new Date().toISOString(), detail: 'Rollback submitted within allowed window.' },
      ...prev,
    ]);
  };

  return { tasks, logs, execute, rollback };
}
