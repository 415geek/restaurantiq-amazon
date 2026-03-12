import { NextRequest, NextResponse } from 'next/server';

const META_CONNECTION_COOKIE = 'meta_connections';

type MetaConnectionsCookie = {
  facebook?: {
    connected: boolean;
    connectedAt: string;
    pages?: Array<{ id: string; name: string }>;
  };
  instagram?: {
    connected: boolean;
    connectedAt: string;
    accounts?: Array<{ id: string; username?: string; name?: string }>;
  };
};

function readConnections(req: NextRequest): MetaConnectionsCookie {
  const raw = req.cookies.get(META_CONNECTION_COOKIE)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as MetaConnectionsCookie;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const envConfigured = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  const data = readConnections(req);

  return NextResponse.json({
    configured: envConfigured,
    facebook: data.facebook ?? { connected: false },
    instagram: data.instagram ?? { connected: false },
    timestamp: new Date().toISOString(),
  });
}

