import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { ShieldCheck } from 'lucide-react';
import { AgentManagementClient } from '@/components/agent-management/AgentManagementClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { isAgentStudioHost } from '@/lib/agent-studio-host';
import { getInternalAgentStudioAccess } from '@/lib/server/internal-access';

export default async function AgentManagementPage() {
  const headerStore = await headers();
  const host = headerStore.get('host');
  if (!isAgentStudioHost(host)) {
    redirect('/dashboard');
  }

  const access = await getInternalAgentStudioAccess();
  if (!access.allowed) {
    if (access.reason === 'auth_missing') {
      redirect('/sign-in');
    }

    return (
      <div className="space-y-6">
        <PageHeader
          title="Agent 管理控制台"
          description="内部 Agent orchestration 管理台。仅限授权内部成员访问。"
          badge="内部专用"
        />
        <Card>
          <CardContent className="space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">未授权访问</h2>
              <p className="mt-2 text-sm text-zinc-400">
                当前登录账号
                {access.email ? ` ${access.email}` : ''}
                没有 Agent Studio 内部权限。系统现在优先检查 Clerk 用户的
                <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">publicMetadata</code>
                角色，推荐写入
                <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">agentStudioRoles</code>
                或
                <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">internalRoles</code>
                ，并包含
                <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">agent_tuner</code>
                、
                <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">internal_admin</code>
                或
                <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">internal_dev</code>
                之一。邮箱白名单仅作为兜底，可通过
                <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">INTERNAL_AGENT_STUDIO_ALLOWED_EMAILS</code>
                或
                <code className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-200">INTERNAL_AGENT_STUDIO_ALLOWED_DOMAINS</code>
                放行。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/dashboard">
                <Button variant="secondary">返回总览</Button>
              </a>
              <a href="/account">
                <Button variant="ghost">前往账户页</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AgentManagementClient />;
}
