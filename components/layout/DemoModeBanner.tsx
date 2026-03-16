'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function DemoModeBanner() {
  const { lang } = useDashboardLanguage();
  const [isDemo, setIsDemo] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/settings/demo-mode', { credentials: 'include', cache: 'no-store' });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled) setIsDemo(Boolean(d.isDemo));
      } catch {
        if (!cancelled) setIsDemo(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const exitDemo = async () => {
    setExiting(true);
    try {
      const res = await fetch('/api/settings/exit-demo', { method: 'POST', credentials: 'include' });
      if (res.ok) window.location.reload();
    } finally {
      setExiting(false);
    }
  };

  if (!isDemo) return null;

  const copy =
    lang === 'zh'
      ? {
          text: '当前为 Demo 模式：接单、改状态、菜单推送仅更新本地，不会同步到 Uber Eats。',
          button: '退出 Demo 模式',
          exiting: '退出中…',
        }
      : {
          text: 'Demo mode: order actions and menu sync update locally only and are not sent to Uber Eats.',
          button: 'Exit demo mode',
          exiting: 'Exiting…',
        };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/50 bg-amber-500/15 px-4 py-2.5 text-sm text-amber-200">
      <span>{copy.text}</span>
      <Button variant="secondary" size="sm" onClick={exitDemo} disabled={exiting}>
        {exiting ? copy.exiting : copy.button}
      </Button>
    </div>
  );
}
