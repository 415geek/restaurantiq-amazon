import { redirect } from 'next/navigation';
import { requireBoAdmin, boAdminEmail } from '@/lib/server/bo-access';

export default async function BoLayout({ children }: { children: React.ReactNode }) {
  const access = await requireBoAdmin();
  if (!access.ok) {
    // Clerk sign-in route exists; preserve deep link.
    if (access.status === 401) {
      redirect(`/sign-in?redirect_url=${encodeURIComponent('/bo')}`);
    }

    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="mt-3 text-sm text-zinc-400">
            This back office is restricted. Please sign in as{' '}
            <span className="font-medium text-zinc-200">{boAdminEmail}</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {children}
    </div>
  );
}
