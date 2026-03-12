'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { integrationEnvStatus } from '@/lib/env';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

const rows = [
  { key: 'clerk', label: 'Clerk', serverOnly: false },
  { key: 'openai', label: 'OpenAI', serverOnly: true },
  { key: 'ubereats', label: 'Uber Eats', serverOnly: true },
  { key: 'yelp', label: 'Yelp', serverOnly: true },
  { key: 'googleMaps', label: 'Google Maps / Places', serverOnly: true },
  { key: 'mapbox', label: 'Mapbox', serverOnly: false },
] as const;

export function ApiKeysNotice() {
  const { copy, lang } = useDashboardLanguage();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{copy.account.securityTitle}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-100">
          {copy.account.securityNote}
        </div>
        <div className="space-y-2">
          {rows.map((row) => {
            const configured = integrationEnvStatus[row.key];
            return (
              <div key={row.key} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div>
                  <p className="text-sm text-zinc-100">{row.label}</p>
                  <p className="text-xs text-zinc-500">{row.serverOnly ? (lang === 'zh' ? '仅服务端密钥' : 'server-only secret') : (lang === 'zh' ? '公钥 / 认证配置' : 'public / auth config')}</p>
                </div>
                <Badge className={configured ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'}>{configured ? copy.account.configured : copy.account.missing}</Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
