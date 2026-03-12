'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

type SwipeToConfirmProps = {
  label?: string;
  confirmLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  threshold?: number;
  onConfirm: () => void | Promise<void>;
};

export default function SwipeToConfirm({
  label,
  confirmLabel,
  disabled,
  loading,
  threshold = 0.8,
  onConfirm,
}: SwipeToConfirmProps) {
  const { copy } = useDashboardLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const x = useMotionValue(0);
  const finalLabel = label ?? copy.swipe.defaultLabel;
  const finalConfirmLabel = confirmLabel ?? copy.swipe.defaultConfirm;

  useEffect(() => {
    const update = () => setWidth(containerRef.current?.offsetWidth ?? 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const maxX = Math.max((width || 0) - 52, 0);
  const thresholdPx = maxX * threshold;
  const progress = useTransform(x, [0, Math.max(maxX, 1)], [0, 1]);
  const fillWidth = useTransform(progress, (p) => `${Math.max(0, Math.min(1, p)) * 100}%`);
  const textOpacity = useTransform(progress, [0, 0.6, 1], [1, 0.75, 0.45]);

  useEffect(() => {
    if (!loading && busy && confirmed) {
      // Keep success state after async confirm resolves.
      setBusy(false);
    }
  }, [loading, busy, confirmed]);

  const reset = () => {
    setConfirmed(false);
    setBusy(false);
    animate(x, 0, { type: 'spring', stiffness: 380, damping: 30 });
  };

  const handleDragEnd = async () => {
    if (disabled || loading || busy || confirmed) return;
    const current = x.get();
    if (current >= thresholdPx) {
      setConfirmed(true);
      setBusy(true);
      animate(x, maxX, { type: 'spring', stiffness: 500, damping: 36 });
      try {
        await onConfirm();
      } catch {
        reset();
      }
      return;
    }
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
  };

  return (
    <div ref={containerRef} className={cn('w-full select-none', disabled && 'opacity-60')}>
      <div className="relative h-14 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
        <motion.div className="absolute inset-y-0 left-0 bg-[#F26A36]/85" style={{ width: fillWidth }} />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-white/5" />
        <motion.div className="absolute inset-0 grid place-items-center px-14" style={{ opacity: textOpacity }}>
          <span className="truncate text-sm font-medium text-zinc-200">{confirmed ? finalConfirmLabel : loading || busy ? copy.swipe.submitting : finalLabel}</span>
        </motion.div>
        <motion.button
          type="button"
          drag={disabled || loading || busy || confirmed ? false : 'x'}
          dragElastic={0}
          dragMomentum={false}
          dragConstraints={{ left: 0, right: maxX }}
          onDragEnd={handleDragEnd}
          style={{ x }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          className={cn(
            'absolute left-1 top-1 grid h-12 w-12 place-items-center rounded-xl border border-[#F26A36]/60 bg-[#F26A36] text-white shadow-lg shadow-[#F26A36]/20',
            (loading || busy) && 'cursor-wait',
          )}
          disabled={disabled || loading}
          aria-label={copy.swipe.aria}
        >
          {loading || busy ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : confirmed ? (
            <Check className="h-5 w-5" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
