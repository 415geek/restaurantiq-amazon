'use client';

import { cn } from '@/lib/utils';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function Switch({ checked, onCheckedChange, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26A36]/70 disabled:opacity-50',
        checked ? 'bg-[#F26A36]/90 border-[#F26A36]' : 'bg-zinc-800 border-zinc-700',
        className,
      )}
      aria-pressed={checked}
    >
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}
