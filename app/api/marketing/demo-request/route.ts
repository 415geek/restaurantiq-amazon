import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DEMO_COOKIE_NAME } from '@/lib/server/demo-session';
import { supabaseAdmin } from '@/lib/server/supabase-admin';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  restaurantName: z.string().min(2).optional(),
  consent: z.boolean().refine((value) => value === true, 'consent_required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = schema.parse(body);

    const demoId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Store lead + consent (server-side only)
    const sb = supabaseAdmin();
    await sb.from('demo_leads').insert({
      name: data.name,
      email: data.email,
      consent: data.consent,
      source: 'hackathon_demo',
      user_agent: request.headers.get('user-agent') ?? null,
      referrer: request.headers.get('referer') ?? null,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Demo session created',
    });

    response.cookies.set(DEMO_COOKIE_NAME, demoId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 6, // 6 hours
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}