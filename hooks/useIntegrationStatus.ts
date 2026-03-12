'use client';

import { useState } from 'react';
import { testIntegration } from '@/lib/api/integrations';
import type { IntegrationStatusItem } from '@/lib/types';

export function useIntegrationStatus(initial: IntegrationStatusItem[]) {
  const [items, setItems] = useState(initial);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const test = async (key: IntegrationStatusItem['key']) => {
    setTestingKey(key);
    try {
      const res = await testIntegration(key);
      setItems((prev) => prev.map((item) =>
        item.key === key
          ? { ...item, status: res.status === 'connected' ? 'connected' : res.status === 'error' ? 'error' : 'missing', detail: res.detail, lastTestedAt: res.timestamp }
          : item
      ));
      return res;
    } finally {
      setTestingKey(null);
    }
  };

  return { items, testingKey, test, setItems };
}
