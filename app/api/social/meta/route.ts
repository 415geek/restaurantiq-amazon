import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSocialRadarSnapshot } from '@/lib/server/adapters/social-radar';

export async function GET() {
  const { userId } = await auth();
  const payload = await getSocialRadarSnapshot(userId ?? 'anonymous');
  return NextResponse.json(payload);
}
