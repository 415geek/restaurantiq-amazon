'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import type { SettingsState } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function ExecutionPolicyPanel({ value, onChange }: { value: SettingsState['executionPolicy']; onChange: (next: SettingsState['executionPolicy']) => void; }) {
  const { copy, lang } = useDashboardLanguage();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{copy.settings.executionPolicy.title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Row title={copy.settings.executionPolicy.allowAutoExecution} desc={copy.settings.executionPolicy.allowAutoExecutionDesc}>
          <Switch checked={value.allowAutoExecution} onCheckedChange={(checked) => onChange({ ...value, allowAutoExecution: checked })} />
        </Row>
        <Row title={copy.settings.executionPolicy.requireSecondConfirm} desc={copy.settings.executionPolicy.requireSecondConfirmDesc}>
          <Switch checked={value.requireSecondConfirmForHighRisk} onCheckedChange={(checked) => onChange({ ...value, requireSecondConfirmForHighRisk: checked })} />
        </Row>
        <div className="grid gap-4 md:grid-cols-3">
          <label>
            <span className="mb-1.5 block text-sm text-zinc-300">{copy.settings.executionPolicy.rollbackWindow}</span>
            <Select value={String(value.rollbackWindowMinutes)} onChange={(e) => onChange({ ...value, rollbackWindowMinutes: Number(e.target.value) as 1 | 3 | 5 })}>
              <option value="1">1 min</option>
              <option value="3">3 min</option>
              <option value="5">5 min</option>
            </Select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm text-zinc-300">{copy.settings.executionPolicy.maxPriceAdjustment}</span>
            <Input type="number" value={value.maxPriceAdjustmentPct} onChange={(e) => onChange({ ...value, maxPriceAdjustmentPct: Number(e.target.value) || 0 })} />
          </label>
          <label className="md:col-span-3">
            <span className="mb-1.5 block text-sm text-zinc-300">{copy.settings.executionPolicy.blacklistCategories}</span>
            <Input value={value.blacklistCategories} onChange={(e) => onChange({ ...value, blacklistCategories: e.target.value })} placeholder={lang === 'zh' ? '酒水, 招牌菜' : 'alcohol, signature dishes'} />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div>
        <p className="text-sm text-zinc-100">{title}</p>
        <p className="text-xs text-zinc-500">{desc}</p>
      </div>
      {children}
    </div>
  );
}
