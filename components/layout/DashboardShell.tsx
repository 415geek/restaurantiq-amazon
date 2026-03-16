'use client';

import { useEffect, useState } from 'react';
import { DashboardNavbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { AnimatePresence, motion } from 'framer-motion';
import { appEnv } from '@/lib/env';
import { GlobalDeliveryOrderAlert } from '@/components/delivery/GlobalDeliveryOrderAlert';
import { DemoModeBanner } from '@/components/layout/DemoModeBanner';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAgentStudioHost, setIsAgentStudioHost] = useState(false);

  useEffect(() => {
    setIsAgentStudioHost(window.location.hostname === appEnv.agentStudioHost);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {!isAgentStudioHost ? (
        <>
          <DemoModeBanner />
          <GlobalDeliveryOrderAlert />
        </>
      ) : null}
      <DashboardNavbar onMobileMenu={() => setMobileOpen(true)} />
      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar agentStudioOnly={isAgentStudioHost} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
            <motion.div initial={{ x: -16, opacity: 0.96 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -12, opacity: 0.96 }} className="absolute left-0 top-0 h-full w-[82%] max-w-sm border-r border-zinc-800 bg-zinc-950 p-4">
              <Sidebar mobile agentStudioOnly={isAgentStudioHost} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
