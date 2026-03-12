import { NextRequest, NextResponse } from 'next/server';
import { integrationEnvStatus } from '@/lib/env';

export async function GET(req: NextRequest) {
  const service = req.nextUrl.searchParams.get('service') as keyof typeof integrationEnvStatus | null;

  if (!service) {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: integrationEnvStatus,
    });
  }

  const configured = integrationEnvStatus[service];
  if (configured) {
    return NextResponse.json({ status: 'connected', detail: `${service} configuration detected.`, timestamp: new Date().toISOString() });
  }
  return NextResponse.json({ status: 'missing', detail: `${service} is not configured in env. Mock fallback active if supported.`, timestamp: new Date().toISOString() });
}
