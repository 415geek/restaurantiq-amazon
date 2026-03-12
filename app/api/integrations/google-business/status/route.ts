import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_BUSINESS_CONNECTION_COOKIE = 'google_business_connection';

type GoogleBusinessConnectionsCookie = {
  connected: boolean;
  connectedAt?: string;
  accounts?: Array<{ name: string; accountName?: string; type?: string }>;
  locations?: Array<{ name: string; title?: string; placeId?: string }>;
};

function readConnections(req: NextRequest): GoogleBusinessConnectionsCookie {
  const raw = req.cookies.get(GOOGLE_BUSINESS_CONNECTION_COOKIE)?.value;
  if (!raw) return { connected: false };
  try {
    return JSON.parse(raw) as GoogleBusinessConnectionsCookie;
  } catch {
    return { connected: false };
  }
}

export async function GET(req: NextRequest) {
  const configured = Boolean(
    process.env.GOOGLE_BUSINESS_CLIENT_ID && process.env.GOOGLE_BUSINESS_CLIENT_SECRET
  );
  const data = readConnections(req);

  return NextResponse.json({
    configured,
    googleBusiness: data,
    timestamp: new Date().toISOString(),
  });
}
