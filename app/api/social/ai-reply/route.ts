import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateNovaCompletion } from '@/lib/server/aws-nova-client';

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

  const { commentText, platform, language } = parsed.data;

  const fallback =
    language === 'zh'
      ? `感谢您的反馈！我们已经注意到您提到的问题（${commentText.slice(0, 26)}...）。我们会立即检查包装与出餐温度，也欢迎您下次再来，我们希望给您更好的体验。`
      : `Thank you for the feedback. We noticed your note (${commentText.slice(0, 32)}...). We'll review packaging and temperature handling with the team right away, and we'd love to provide a better experience next time.`;

  try {
    const prompt =
      language === 'zh'
        ? [
            '你是北美餐厅的店主助理，请为社交媒体评论生成一条专业、真诚、简短的回复。',
            '要求：使用简体中文；不承诺无法兑现的补偿；语气礼貌；长度 40-90 字；不要出现表情符号；不要输出引号或多余解释。',
            `平台：${platform}`,
            `评论：${commentText}`,
            '只输出回复正文：',
          ].join('\n')
        : [
            'You are a restaurant owner assistant. Write a professional, sincere, short reply to a social media comment.',
            'Requirements: English only; do not promise refunds/compensation; polite tone; 1-3 sentences; 35-80 words; no emojis; do not wrap in quotes; no extra explanation.',
            `Platform: ${platform}`,
            `Comment: ${commentText}`,
            'Output only the reply text:',
          ].join('\n');

    const raw = await generateNovaCompletion(prompt, {
      model: process.env.AWS_NOVA_SOCIAL_MODEL || 'amazon.nova-lite-v1:0',
      temperature: 0.4,
      maxTokens: 220,
    });
    const reply = (raw || '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
    if (reply.length < 10) throw new Error('nova_reply_too_short');

    return NextResponse.json({ success: true, reply, source: 'nova' });
  } catch {
    return NextResponse.json({ success: true, reply: fallback, source: 'template' });
  }
}
