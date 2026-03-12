'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import type { SettingsState } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function ModelRoutingConfig({ value, onChange }: { value: SettingsState['modelRouting']; onChange: (next: SettingsState['modelRouting']) => void }) {
  const { copy } = useDashboardLanguage();
  const estimatedCost = ((value.dailyTokenBudget / 1000) * (value.optimizationMode === 'quality' ? 0.012 : 0.0065)).toFixed(2);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{copy.settings.modelRouting.title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={copy.settings.modelRouting.simpleTasks}><Input value={value.simpleTaskModel} onChange={(e) => onChange({ ...value, simpleTaskModel: e.target.value })} /></Field>
          <Field label={copy.settings.modelRouting.analysisTasks}><Input value={value.analysisTaskModel} onChange={(e) => onChange({ ...value, analysisTaskModel: e.target.value })} /></Field>
          <Field label={copy.settings.modelRouting.criticalDecisions}><Input value={value.criticalDecisionModel} onChange={(e) => onChange({ ...value, criticalDecisionModel: e.target.value })} /></Field>
          <Field label={copy.settings.modelRouting.tokenBudget}><Input type="number" value={value.dailyTokenBudget} onChange={(e) => onChange({ ...value, dailyTokenBudget: Number(e.target.value) || 0 })} /></Field>
          <Field label={copy.settings.modelRouting.estimatedCost}><Input readOnly value={`~$${estimatedCost}/day`} /></Field>
          <Field label={copy.settings.modelRouting.preset}>
            <Select value={value.optimizationMode === 'cost' ? 'cost' : 'quality'} onChange={(e) => onChange({ ...value, optimizationMode: e.target.value as 'cost' | 'quality' })}>
              <option value="cost">{copy.settings.modelRouting.presetCost}</option>
              <option value="quality">{copy.settings.modelRouting.presetQuality}</option>
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm text-zinc-300">{copy.settings.modelRouting.optimizationMode}</p>
          <Tabs items={[{ label: copy.settings.modelRouting.qualityFirst, value: 'quality' }, { label: copy.settings.modelRouting.costFirst, value: 'cost' }]} value={value.optimizationMode} onChange={(mode) => onChange({ ...value, optimizationMode: mode })} />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-sm text-zinc-300">{label}</span>{children}</label>;
}
