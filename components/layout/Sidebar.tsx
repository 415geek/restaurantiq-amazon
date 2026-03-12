'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LineChart,
  MessageSquareCode,
  Settings,
  UserCircle,
  Radar,
  Workflow,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

export function Sidebar({ mobile = false, agentStudioOnly = false }: { mobile?: boolean; agentStudioOnly?: boolean }) {
  const pathname = usePathname();
  const { copy } = useDashboardLanguage();
  const fullItems = [
    { href: '/dashboard', label: copy.common.dashboard, icon: LayoutDashboard },
    { href: '/analysis', label: copy.common.analysis, icon: LineChart },
    { href: '/ops-copilot', label: copy.common.opsCopilot, icon: MessageSquareCode },
    { href: '/delivery', label: copy.common.delivery, icon: Truck },
    { href: '/menu-management', label: copy.common.menuManagement, icon: UtensilsCrossed },
    { href: '/agent-management', label: copy.common.agentStudio, icon: Workflow },
    { href: '/social-radar', label: copy.common.socialRadar, icon: Radar },
    { href: '/settings', label: copy.common.settings, icon: Settings },
    { href: '/account', label: copy.common.account, icon: UserCircle },
  ];
  const items = agentStudioOnly
    ? [{ href: '/agent-management', label: copy.common.agentStudio, icon: Workflow }]
    : fullItems.filter((item) => item.href !== '/agent-management');
  return (
    <aside className={cn('w-64 shrink-0 border-r border-zinc-800 bg-zinc-950/70 p-4', mobile ? 'block h-full border-r-0 p-0' : 'hidden lg:block')}>
      <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#F26A36]/20 bg-[#F26A36]/10">
            <img src="/branding/logo-mark.png" alt="Restaurant IQ logo" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <img src="/branding/logo-wordmark.png" alt="Restaurant IQ" className="h-5 w-auto object-contain" />
            <div className="text-xs text-zinc-400">{agentStudioOnly ? copy.shell.internalStudio : copy.shell.subtitle}</div>
          </div>
        </div>
      </div>
      <nav className="space-y-1.5">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'border-[#F26A36]/40 bg-[#F26A36]/10 text-[#F7A27F]'
                  : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
