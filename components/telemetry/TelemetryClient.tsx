'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';

function safeHref(raw: string | null) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    return url.pathname + url.search;
  } catch {
    return undefined;
  }
}

function sendEvent(payload: { eventName: string; pathname: string; props?: Record<string, unknown> }) {
  try {
    void fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

function sendPageview(payload: { pathname: string; referrer?: string }) {
  try {
    void fetch('/api/telemetry/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

export function TelemetryClient() {
  const pathname = usePathname() || '/';
  const startRef = useRef<number>(Date.now());

  const referrer = useMemo(() => {
    if (typeof document === 'undefined') return undefined;
    return document.referrer || undefined;
  }, []);

  useEffect(() => {
    startRef.current = Date.now();
    sendPageview({ pathname, referrer });
  }, [pathname, referrer]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const el = target.closest('button,a,[role="button"]') as HTMLElement | null;
      if (!el) return;

      const trackName = el.getAttribute('data-track') || undefined;
      const tag = el.tagName.toLowerCase();
      const id = el.id || undefined;
      const aria = el.getAttribute('aria-label') || undefined;
      const href = tag === 'a' ? safeHref((el as HTMLAnchorElement).getAttribute('href')) : undefined;

      // Avoid logging innerText to reduce PII risk.
      sendEvent({
        eventName: 'click',
        pathname,
        props: {
          trackName,
          tag,
          id,
          ariaLabel: aria,
          href,
        },
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      const durationMs = Date.now() - startRef.current;
      sendEvent({
        eventName: 'page_duration',
        pathname,
        props: { durationMs },
      });
    };

    window.addEventListener('click', onClick, { capture: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('click', onClick, { capture: true } as any);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pathname]);

  return null;
}
