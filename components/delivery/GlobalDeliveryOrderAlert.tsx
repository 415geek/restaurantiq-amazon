'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Clock3, ReceiptText, Store, Truck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import type { DeliveryOrderQueryRow, DeliveryOrderStatus } from '@/lib/delivery-management-types';

type PollResponse = {
  orders?: DeliveryOrderQueryRow[];
};

const POLL_INTERVAL_MS = 7000;
const MAX_ALERT_QUEUE = 8;

const ACTION_LABELS: Record<
  DeliveryOrderStatus,
  { zh: string; en: string; next?: DeliveryOrderStatus }
> = {
  new: { zh: '接单', en: 'Accept', next: 'accepted' },
  accepted: { zh: '开始制作', en: 'Start Prep', next: 'preparing' },
  preparing: { zh: '标记待取', en: 'Mark Ready', next: 'ready' },
  ready: { zh: '完成', en: 'Complete', next: 'completed' },
  completed: { zh: '已完成', en: 'Completed' },
  cancelled: { zh: '已取消', en: 'Cancelled' },
};

function orderKey(order: DeliveryOrderQueryRow) {
  return `${order.platform}:${order.id}`;
}

export function GlobalDeliveryOrderAlert() {
  const toast = useToast();
  const { lang } = useDashboardLanguage();

  const [queue, setQueue] = useState<DeliveryOrderQueryRow[]>([]);
  const [busy, setBusy] = useState(false);

  const initializedRef = useRef(false);
  const knownOrderRef = useRef<Set<string>>(new Set());
  const dismissedRef = useRef<Set<string>>(new Set());

  const copy = useMemo(
    () =>
      lang === 'zh'
        ? {
            title: '新订单提醒',
            subtitle: '检测到新订单，请尽快处理。',
            queued: '待处理新单',
            customer: '顾客',
            amount: '金额',
            placedAt: '下单时间',
            eta: '预计出餐',
            dismiss: '稍后处理',
            openDelivery: '打开订单中心',
            cancel: '取消订单',
            actionDone: '订单状态已更新',
            actionFail: '订单操作失败',
            warningPrefix: '提醒',
          }
        : {
            title: 'New Order Alert',
            subtitle: 'A new order arrived. Please process it now.',
            queued: 'Queued new orders',
            customer: 'Customer',
            amount: 'Amount',
            placedAt: 'Placed at',
            eta: 'Prep ETA',
            dismiss: 'Handle later',
            openDelivery: 'Open Order Center',
            cancel: 'Cancel order',
            actionDone: 'Order status updated',
            actionFail: 'Order action failed',
            warningPrefix: 'Warning',
          },
    [lang]
  );

  const active = queue[0] ?? null;

  useEffect(() => {
    let closed = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/delivery/orders?platform=ubereats', {
          cache: 'no-store',
        });
        if (!res.ok) return;

        const payload = (await res.json().catch(() => ({}))) as PollResponse;
        const rows = Array.isArray(payload.orders) ? payload.orders : [];
        const knownBefore = new Set(knownOrderRef.current);

        const currentlyNew = new Set<string>();
        for (const row of rows) {
          const key = orderKey(row);
          if (row.status === 'new') currentlyNew.add(key);
        }

        if (!initializedRef.current) {
          for (const row of rows) {
            knownOrderRef.current.add(orderKey(row));
          }
          initializedRef.current = true;
          return;
        }

        const fresh = rows
          .filter(
            (row) =>
              row.status === 'new' &&
              !dismissedRef.current.has(orderKey(row)) &&
              !knownBefore.has(orderKey(row))
          )
          .slice(0, MAX_ALERT_QUEUE);

        for (const row of rows) {
          knownOrderRef.current.add(orderKey(row));
        }

        if (fresh.length) {
          setQueue((prev) => {
            const keys = new Set(prev.map(orderKey));
            const next = [...prev];
            for (const row of fresh) {
              const key = orderKey(row);
              if (keys.has(key)) continue;
              next.push(row);
              keys.add(key);
            }
            return next.slice(0, MAX_ALERT_QUEUE);
          });
          toast.success(
            lang === 'zh'
              ? `收到 ${fresh.length} 笔新订单`
              : `${fresh.length} new order(s) received`
          );
        }

        if (closed) return;
        setQueue((prev) => prev.filter((row) => currentlyNew.has(orderKey(row))));
      } catch {
        // Keep alert polling silent.
      }
    };

    const bootstrap = async () => {
      try {
        const res = await fetch('/api/delivery/orders?platform=ubereats', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => ({}))) as PollResponse;
        const rows = Array.isArray(payload.orders) ? payload.orders : [];
        for (const row of rows) {
          knownOrderRef.current.add(orderKey(row));
        }
      } finally {
        initializedRef.current = true;
      }
    };

    void bootstrap();
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      closed = true;
      window.clearInterval(interval);
    };
  }, [lang, toast]);

  const dismissActive = () => {
    if (!active) return;
    dismissedRef.current.add(orderKey(active));
    setQueue((prev) => prev.filter((row) => orderKey(row) !== orderKey(active)));
  };

  const runAction = async (nextStatus: DeliveryOrderStatus) => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/delivery/orders/${encodeURIComponent(active.id)}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : copy.actionFail
        );
      }
      toast.success(copy.actionDone);
      if (typeof payload?.warning === 'string' && payload.warning.trim()) {
        toast.warning(`${copy.warningPrefix}: ${payload.warning}`);
      }
      setQueue((prev) => prev.filter((row) => orderKey(row) !== orderKey(active)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const openDeliveryWorkspace = () => {
    window.location.href = '/delivery';
  };

  const primaryAction = active ? ACTION_LABELS[active.status] : null;

  return (
    <Modal
      open={Boolean(active)}
      onOpenChange={(open) => {
        if (!open) dismissActive();
      }}
      title={copy.title}
      className="max-w-lg"
    >
      {!active ? null : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#F26A36]/30 bg-[#F26A36]/10 p-3">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F7A27F]">
                <BellRing className="h-4 w-4" />
                {copy.subtitle}
              </div>
              <Badge>{queue.length}</Badge>
            </div>
            <p className="text-xs text-zinc-300">
              {copy.queued}: {queue.length}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-100">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{active.channelOrderId}</p>
              <Badge className="border-zinc-700 bg-zinc-950/70 text-zinc-300">
                {active.platform}
              </Badge>
            </div>
            <div className="grid gap-2 text-xs text-zinc-300">
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <Store className="h-3.5 w-3.5" /> {copy.customer}
                </span>
                <span>{active.customerName}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <ReceiptText className="h-3.5 w-3.5" /> {copy.amount}
                </span>
                <span>${active.amount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <Clock3 className="h-3.5 w-3.5" /> {copy.placedAt}
                </span>
                <span>{new Date(active.placedAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <Truck className="h-3.5 w-3.5" /> {copy.eta}
                </span>
                <span>{active.etaMins}m</span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {primaryAction?.next ? (
              <Button
                onClick={() => {
                  const nextStatus = primaryAction.next;
                  if (!nextStatus) return;
                  runAction(nextStatus);
                }}
                disabled={busy}
              >
                {lang === 'zh' ? primaryAction.zh : primaryAction.en}
              </Button>
            ) : null}
            <Button
              variant="danger"
              onClick={() => runAction('cancelled')}
              disabled={busy || active.status === 'cancelled' || active.status === 'completed'}
            >
              {copy.cancel}
            </Button>
            <Button variant="secondary" onClick={openDeliveryWorkspace} disabled={busy}>
              {copy.openDelivery}
            </Button>
            <Button variant="ghost" onClick={dismissActive} disabled={busy}>
              {copy.dismiss}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
