import { NextResponse } from 'next/server';
import { z } from 'zod';

const executeSchema = z.object({
  recommendationId: z.string().min(1),
  execution_params: z.record(z.string(), z.unknown()).default({}),
});

const rollbackSchema = z.object({ taskId: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = executeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid execute payload.' }, { status: 400 });
  }

  const rollbackDeadline = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  return NextResponse.json({
    status: 'pending',
    task_id: `task_${Date.now()}`,
    rollback_deadline: rollbackDeadline,
    result: `Execution accepted for ${parsed.data.recommendationId}`,
  });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = rollbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid rollback payload.' }, { status: 400 });
  }
  return NextResponse.json({ success: true, status: 'rolled_back', task_id: parsed.data.taskId });
}
