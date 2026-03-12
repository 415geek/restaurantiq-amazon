'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { LineChart, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import { appEnv } from '@/lib/env';

export function DashboardNavbar({ onMobileMenu }: { onMobileMenu?: () => void }) {
  const pathname = usePathname();
  const { copy, toggleLang } = useDashboardLanguage();
  const [isAgentStudioHost, setIsAgentStudioHost] = useState(false);
  useEffect(() => {
    setIsAgentStudioHost(window.location.hostname === appEnv.agentStudioHost);
  }, []);

  const navItems = isAgentStudioHost
    ? [{ href: '/agent-management', label: copy.common.agentStudio }]
    : [
    { href: '/dashboard', label: copy.common.dashboard },
    { href: '/analysis', label: copy.common.analysis },
    { href: '/ops-copilot', label: copy.common.opsCopilot },
    { href: '/delivery', label: copy.common.delivery },
    { href: '/menu-management', label: copy.common.menuManagement },
    { href: '/social-radar', label: copy.common.socialRadar },
    { href: '/settings', label: copy.common.settings },
    { href: '/account', label: copy.common.account },
  ];
  const authDisabled = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button type="button" onClick={onMobileMenu} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300 lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
          <Link href={isAgentStudioHost ? '/agent-management' : '/dashboard'} className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#F26A36]/20 bg-[#F26A36]/10">
              <img src="/branding/logo-mark.png" alt="Restaurant IQ logo" className="h-6 w-6 object-contain" />
            </div>
            <div className="hidden sm:block">
              <img src="/branding/logo-wordmark.png" alt="Restaurant IQ" className="h-4 w-auto object-contain" />
            </div>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={cn('rounded-lg px-3 py-2 text-sm', pathname === item.href ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100')}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {isAgentStudioHost ? <span className="hidden rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs text-orange-300 sm:inline-flex">{copy.shell.internalStudio}</span> : null}
          <button type="button" aria-label={copy.common.languageAria} onClick={toggleLang} className="inline-flex h-9 min-w-10 items-center justify-center rounded-lg border border-zinc-800 px-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900">
            {copy.common.languageToggle}
          </button>
          {authDisabled ? (
            <>
              <Link href="/sign-in"><Button variant="ghost" size="sm">{copy.common.signIn}</Button></Link>
              <Link href="/sign-up"><Button size="sm">{copy.common.startTrial}</Button></Link>
            </>
          ) : (
            <>
              <SignedOut>
                <SignInButton mode="redirect">
                  <Button variant="ghost" size="sm">{copy.common.signIn}</Button>
                </SignInButton>
                <SignUpButton mode="redirect">
                  <Button size="sm">{copy.common.startTrial}</Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/analysis">
                  <Button variant="secondary" size="sm" className="px-2 sm:px-3" aria-label={copy.common.runAnalysis}>
                    <LineChart className="h-4 w-4" />
                    <span className="hidden sm:inline">{copy.common.runAnalysis}</span>
                  </Button>
                </Link>
                <div className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 p-1">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
            </>
          )}
          {authDisabled ? <span className="hidden rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs text-orange-300 sm:inline-flex">{process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' ? copy.common.mockMode : copy.common.authNotConfigured}</span> : null}
        </div>
      </div>
    </header>
  );
}
