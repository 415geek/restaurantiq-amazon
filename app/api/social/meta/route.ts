import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSocialRadarSnapshot } from '@/lib/server/adapters/social-radar';

export async function GET() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId ?? null;
  } catch {
    userId = null;
  }
  const payload = await getSocialRadarSnapshot(userId ?? 'anonymous');
  return NextResponse.json(payload);
}
