import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { requireBoAdmin } from '@/lib/server/bo-access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  plan: z.string().max(40).optional(),
  status: z.string().max(40).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const access = await requireBoAdmin();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const { userId } = await context.params;
  const payload = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = (user.publicMetadata || {}) as Record<string, unknown>;

  const next = {
    ...existing,
    ...(parsed.data.plan ? { subscriptionPlan: parsed.data.plan } : {}),
    ...(parsed.data.status ? { subscriptionStatus: parsed.data.status } : {}),
  };

  await client.users.updateUser(userId, {
    publicMetadata: next,
  });

  return NextResponse.json({ ok: true });
}