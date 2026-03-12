import * as React from 'react';
import { cn } from '@/lib/utils';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26A36]/60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
