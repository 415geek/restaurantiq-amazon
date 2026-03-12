'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';

export function useToast() {
  return useMemo(
    () => ({
      success: (message: string) => toast.success(message),
      error: (message: string) => toast.error(message),
      info: (message: string) => toast(message),
      warning: (message: string) => toast.warning(message),
    }),
    []
  );
}
