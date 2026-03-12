import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchBusinessCandidatesByAddress } from '@/lib/server/business-intel-analysis';

const schema = z.object({
  address: z.string().min(3),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid business search payload.',
        candidates: [],
      },
      { status: 400 }
    );
  }

  const address = parsed.data.address.trim();
  const result = await searchBusinessCandidatesByAddress(address);

  return NextResponse.json({
    source: result.source,
    address,
    candidates: result.candidates,
    warning: result.warning,
  });
}
