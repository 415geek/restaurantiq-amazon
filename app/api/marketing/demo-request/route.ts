import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2),
  restaurantName: z.string().min(2),
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    schema.parse(body);
    console.log('Demo Request Received:', body);
    await new Promise(res => setTimeout(res, 1000));
    return NextResponse.json({ success: true, message: 'Request received!' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
