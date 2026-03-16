import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  clearPersistedAnalysisRuntimeState,
  loadPersistedAnalysisRuntimeState,
} from '@/lib/server/analysis-runtime-store';
import { getDemoIdFromRequest } from '@/lib/server/demo-session';

function unauthorized() {
  return NextResponse.json({ error: 'auth_required' }, { status: 401 });
}

export async function GET(req: Request) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  if (demoId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return unauthorized();

  const state = await loadPersistedAnalysisRuntimeState(userId);
  if (!state) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(state);
}

export async function DELETE(req: Request) {
  const demoId = getDemoIdFromRequest({ headers: req.headers });
  if (demoId) {
    return NextResponse.json({ ok: true });
  }

  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return unauthorized();

  await clearPersistedAnalysisRuntimeState(userId);
  return NextResponse.json({ ok: true });
}
