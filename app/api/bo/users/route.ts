import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireBoAdmin } from '@/lib/server/bo-access';

export const runtime = 'nodejs';

export async function GET() {
  const access = await requireBoAdmin();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const client = await clerkClient();
  const users = await client.users.getUserList({
    limit: 50,
    orderBy: '-created_at',
  });

  return NextResponse.json({
    ok: true,
    users: users.data.map((user) => {
      const email =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress || user.emailAddresses[0]?.emailAddress || '';

      const meta = (user.publicMetadata || {}) as Record<string, unknown>;

      return {
        id: user.id,
        email,
        createdAt: new Date(user.createdAt).toISOString(),
        lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt).toISOString() : undefined,
        subscriptionPlan:
          typeof meta.subscriptionPlan === 'string' ? meta.subscriptionPlan : undefined,
        subscriptionStatus:
          typeof meta.subscriptionStatus === 'string' ? meta.subscriptionStatus : undefined,
      };
    }),
  });
}