'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import type { SettingsState } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function AgentTogglePanel({ value, onChange }: { value: SettingsState['agentConfig']; onChange: (next: SettingsState['agentConfig']) => void; }) {
  const { copy, lang } = useDashboardLanguage();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{copy.settings.agentPanel.title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {([
          ['agentAEnabled', copy.settings.agentPanel.agentA],
          ['agentBEnabled', copy.settings.agentPanel.agentB],
          ['agentCEnabled', copy.settings.agentPanel.agentC],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
            <div>
              <p className="text-sm text-zinc-100">{label}</p>
              <p className="text-xs text-zinc-500">{copy.settings.agentPanel.agentDesc}</p>
            </div>
            <Switch checked={value[key]} onCheckedChange={(checked) => onChange({ ...value, [key]: checked })} />
          </div>
        ))}
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-sm text-zinc-300">{copy.settings.agentPanel.refreshFrequency}</span>
            <Select value={value.refreshFrequency} onChange={(e) => onChange({ ...value, refreshFrequency: e.target.value as SettingsState['agentConfig']['refreshFrequency'] })}>
              <option value="5m">5 min</option>
              <option value="15m">15 min</option>
              <option value="1h">1 hour</option>
              <option value="manual">{lang === 'zh' ? '手动' : 'Manual'}</option>
            </Select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm text-zinc-300">{copy.settings.agentPanel.severityThreshold}</span>
            <Select value={value.severityThreshold} onChange={(e) => onChange({ ...value, severityThreshold: e.target.value as SettingsState['agentConfig']['severityThreshold'] })}>
              <option value="low">{lang === 'zh' ? '低' : 'low'}</option>
              <option value="medium">{lang === 'zh' ? '中' : 'medium'}</option>
              <option value="high">{lang === 'zh' ? '高' : 'high'}</option>
            </Select>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
