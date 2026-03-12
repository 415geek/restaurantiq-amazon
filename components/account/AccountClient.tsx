'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SubscriptionCard } from '@/components/account/SubscriptionCard';
import { TeamMembersPanel } from '@/components/account/TeamMembersPanel';
import { ApiKeysNotice } from '@/components/account/ApiKeysNotice';
import { OrgProfileCard } from '@/components/account/OrgProfileCard';
import { mockSubscription, mockTeamMembers } from '@/lib/mock-data';
import type { TeamMember } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function AccountClient() {
  const { copy, lang } = useDashboardLanguage();
  const { user, isLoaded } = useUser();
  const [members, setMembers] = useState<TeamMember[]>(mockTeamMembers);
  const toast = useToast();

  return (
    <div className="space-y-6">
      <PageHeader title={copy.accountPage.title} description={copy.accountPage.description} badge={copy.accountPage.badge} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">{copy.accountPage.currentUser}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!isLoaded ? (
              <div className="h-20 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" />
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#F26A36]/15 text-sm font-semibold text-[#F26A36]">{(user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || 'U').toUpperCase()}</div>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{user?.fullName || copy.account.demoUser}</p>
                    <p className="text-xs text-zinc-400">{user?.primaryEmailAddress?.emailAddress || 'demo@restaurantiq.ai'}</p>
                  </div>
                  <Badge className="ml-auto">{copy.account.rolePlaceholder}</Badge>
                </div>
                <p className="text-xs text-zinc-500">{lang === 'zh' ? '登录后显示 Clerk 用户资料；如启用 mock 模式则显示占位数据。' : 'Clerk profile is shown when logged in. In mock mode, placeholder values are used.'}</p>
              </>
            )}
          </CardContent>
        </Card>
        <OrgProfileCard />
      </div>

      <SubscriptionCard plan={mockSubscription} onUpgrade={() => toast.info(copy.account.upgradeToast)} />
      <TeamMembersPanel
        members={members}
        onInvite={(payload) => {
          setMembers((prev) => [{ id: `tm-${Date.now()}`, name: payload.name, email: payload.email, role: payload.role, status: 'invited' }, ...prev]);
          toast.success(`${copy.account.inviteSentPrefix}${payload.email}${lang === 'zh' ? '（模拟）' : ' (mock)'}`);
        }}
      />
      <ApiKeysNotice />
    </div>
  );
}
