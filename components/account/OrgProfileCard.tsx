'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function OrgProfileCard({ name = 'Golden Harbor Group', role = 'Owner' }: { name?: string; role?: 'Owner' | 'Manager' | 'Staff' }) {
  const { copy } = useDashboardLanguage();
  const localizedRole = copy.account.roleLabels[role];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{copy.account.orgTitle}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs text-zinc-500">{copy.account.orgName}</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{name}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">{copy.account.role}</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">{localizedRole}</p>
          </div>
          <Badge>{localizedRole}</Badge>
        </div>
        <p className="text-xs text-zinc-500">{copy.account.orgFootnote}</p>
      </CardContent>
    </Card>
  );
}
