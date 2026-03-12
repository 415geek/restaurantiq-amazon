import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  commentId: z.string().min(1),
  commentText: z.string().min(1),
  platform: z.string().min(1),
  language: z.enum(['zh', 'en']).default('en'),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { commentText, language } = parsed.data;
  const reply = language === 'zh'
    ? `感谢您的反馈！我们已经注意到您提到的问题（${commentText.slice(0, 26)}...）。我们会立即检查包装与出餐温度，也欢迎您下次再来，我们希望给您更好的体验。`
    : `Thank you for the feedback. We noticed your note (${commentText.slice(0, 32)}...). We'll review packaging and temperature handling with the team right away, and we'd love to provide a better experience next time.`;

  return NextResponse.json({ success: true, reply, source: process.env.OPENAI_API_KEY ? 'template-fallback' : 'mock' });
}
