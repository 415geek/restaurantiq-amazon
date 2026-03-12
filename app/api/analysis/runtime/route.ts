import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  clearPersistedAnalysisRuntimeState,
  loadPersistedAnalysisRuntimeState,
} from '@/lib/server/analysis-runtime-store';

function unauthorized() {
  return NextResponse.json({ error: 'auth_required' }, { status: 401 });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const state = await loadPersistedAnalysisRuntimeState(userId);
  if (!state) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(state);
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  await clearPersistedAnalysisRuntimeState(userId);
  return NextResponse.json({ ok: true });
}
