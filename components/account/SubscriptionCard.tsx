'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { SubscriptionPlan } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function SubscriptionCard({ plan, onUpgrade }: { plan: SubscriptionPlan; onUpgrade: () => void }) {
  const { copy } = useDashboardLanguage();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{copy.account.subscription}</CardTitle>
          <p className="mt-1 text-sm text-zinc-400">{copy.account.currentPlan}: {plan.plan}</p>
        </div>
        <Button onClick={onUpgrade}>{copy.account.upgrade}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label={copy.account.subscriptionStats.plan} value={plan.priceLabel} />
          <Stat label={copy.account.subscriptionStats.analysisUsage} value={`${plan.analysisUsed}/${plan.analysisLimit}`} />
          <Stat label={copy.account.subscriptionStats.executionUsage} value={`${plan.executionUsed}/${plan.executionLimit}`} />
        </div>
        <ul className="grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
          {plan.features.map((feature) => <li key={feature} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">{feature}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-base font-semibold text-zinc-100">{value}</p></div>;
}
