import { DashboardShell } from '@/components/layout/DashboardShell';
import { DashboardLanguageProvider } from '@/components/providers/DashboardLanguageProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLanguageProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardLanguageProvider>
  );
}
