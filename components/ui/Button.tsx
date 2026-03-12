'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

const variantStyles: Record<Variant, string> = {
  primary: 'bg-[#F26A36] text-white hover:bg-[#ff7a48] border border-[#F26A36]',
  secondary: 'bg-zinc-900 text-zinc-100 border border-zinc-800 hover:bg-zinc-800',
  ghost: 'bg-transparent text-zinc-200 border border-transparent hover:bg-zinc-900/70',
  danger: 'bg-red-600 text-white border border-red-500 hover:bg-red-500',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-11 px-5 text-sm rounded-xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26A36]/70 disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
});
