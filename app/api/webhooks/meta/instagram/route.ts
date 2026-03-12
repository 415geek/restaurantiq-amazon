import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');
  const expected = process.env.META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token && challenge && expected && token === expected) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Webhook verification failed',
      details: !expected ? 'META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not configured' : 'Token mismatch or invalid query params',
    },
    { status: 403 }
  );
}

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Meta may send non-JSON in some edge cases; accept request and return 200.
  }

  // Placeholder endpoint for future Meta webhook processing.
  // Intentionally no logging of payload contents to avoid leaking user data in logs.
  return NextResponse.json({
    ok: true,
    received: Boolean(body),
    message: 'Meta Instagram webhook endpoint is configured (placeholder handler).',
  });
}

