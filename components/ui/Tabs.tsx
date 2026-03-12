'use client';

import { cn } from '@/lib/utils';

type TabItem<T extends string> = { label: string; value: T };

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn('inline-flex rounded-xl border border-zinc-800 bg-zinc-900 p-1', className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm transition-colors',
            value === item.value ? 'bg-[#F26A36] text-white' : 'text-zinc-400 hover:text-zinc-100'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
