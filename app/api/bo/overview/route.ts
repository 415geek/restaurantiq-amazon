import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabase-admin';
import { requireBoAdmin } from '@/lib/server/bo-access';

export const runtime = 'nodejs';

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET() {
  const access = await requireBoAdmin();
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const sb = supabaseAdmin();
  const since7d = isoDaysAgo(7);
  const since24h = isoDaysAgo(1);

  const [leads, pageviews, events] = await Promise.all([
    sb
      .from('demo_leads')
      .select('created_at,name,email,consent', { count: 'exact' })
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(20),
    sb
      .from('telemetry_pageviews')
      .select('created_at,session_id,pathname', { count: 'exact' })
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(5000),
    sb
      .from('telemetry_events')
      .select('created_at,session_id,event_name,pathname', { count: 'exact' })
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  const activeSessions = await sb
    .from('telemetry_pageviews')
    .select('session_id')
    .gte('created_at', since24h)
    .limit(5000);

  const activeSessions24h = new Set(
    (activeSessions.data || []).map((row: any) => String(row.session_id))
  ).size;

  const topPagesMap = new Map<string, number>();
  for (const row of pageviews.data || []) {
    const path = String((row as any).pathname || '/');
    topPagesMap.set(path, (topPagesMap.get(path) || 0) + 1);
  }
  const topPages7d = Array.from(topPagesMap.entries())
    .map(([pathname, count]) => ({ pathname, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const recentEvents = (events.data || []).slice(0, 12).map((row: any) => ({
    created_at: row.created_at,
    event_name: row.event_name,
    pathname: row.pathname,
  }));

  const recentLeads = (leads.data || []).slice(0, 12).map((row: any) => ({
    created_at: row.created_at,
    name: row.name,
    email: row.email,
    consent: Boolean(row.consent),
  }));

  return NextResponse.json({
    ok: true,
    counts: {
      demoLeads7d: leads.count ?? 0,
      pageviews7d: pageviews.count ?? 0,
      events7d: events.count ?? 0,
      activeSessions24h,
    },
    topPages7d,
    recentEvents,
    recentLeads,
  });
}
