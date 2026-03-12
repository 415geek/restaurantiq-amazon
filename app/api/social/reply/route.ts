import { NextResponse } from 'next/server';
import { z } from 'zod';

const sendSchema = z.object({
  commentId: z.string().min(1),
  replyText: z.string().min(1),
  platform: z.string().min(1),
  aiGenerated: z.boolean().optional().default(false),
});

const rollbackSchema = z.object({ commentId: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  return NextResponse.json({
    success: true,
    status: 'sent',
    message_id: `reply_${Date.now()}`,
    rollback_deadline: parsed.data.aiGenerated ? new Date(Date.now() + 60_000).toISOString() : null,
  });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = rollbackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  return NextResponse.json({ success: true, status: 'rolled_back', commentId: parsed.data.commentId });
}
