'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => onOpenChange(false)} aria-label="Close modal" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className={cn('w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl', className)}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-5">{children}</div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
