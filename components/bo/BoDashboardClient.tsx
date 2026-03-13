'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Users, Activity, MousePointerClick, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';

type Overview = {
  ok: true;
  counts: {
    demoLeads7d: number;
    pageviews7d: number;
    events7d: number;
    activeSessions24h: number;
  };
  topPages7d: Array<{ pathname: string; count: number }>;
  recentEvents: Array<{ created_at: string; event_name: string; pathname: string }>;
  recentLeads: Array<{ created_at: string; name: string; email: string; consent: boolean }>;
};

type ClerkUserRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
};

type UsersResponse = {
  ok: true;
  users: ClerkUserRow[];
};

export function BoDashboardClient() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<ClerkUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bo/overview', { cache: 'no-store' });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || 'overview_failed');
      setOverview(payload as Overview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'overview_failed');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/bo/users', { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as UsersResponse | null;
      if (!res.ok || !payload?.ok) throw new Error((payload as any)?.error || 'users_failed');
      setUsers(payload.users);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'users_failed');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topPages = useMemo(() => overview?.topPages7d || [], [overview]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Back Office</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Global admin dashboard for leads, traffic, and user management.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading || !overview ? (
        <Card>
          <CardContent className="py-10 text-sm text-zinc-400">Loading…</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<Users className="h-4 w-4" />}
              label="Demo leads (7d)"
              value={overview.counts.demoLeads7d}
            />
            <MetricCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="Pageviews (7d)"
              value={overview.counts.pageviews7d}
            />
            <MetricCard
              icon={<MousePointerClick className="h-4 w-4" />}
              label="Events (7d)"
              value={overview.counts.events7d}
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              label="Active sessions (24h)"
              value={overview.counts.activeSessions24h}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top pages (7 days)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topPages.length ? (
                  topPages.map((row) => (
                    <div
                      key={`${row.pathname}-${row.count}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-100">{row.pathname}</p>
                      </div>
                      <Badge className="border-zinc-700 bg-zinc-950 text-zinc-200">
                        {row.count}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No data yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.recentEvents.length ? (
                  overview.recentEvents.map((row, idx) => (
                    <div
                      key={`${row.created_at}-${idx}`}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-100">{row.event_name}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(row.created_at).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-400">{row.pathname}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No events yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent demo signups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.recentLeads.length ? (
                  overview.recentLeads.map((lead, idx) => (
                    <div
                      key={`${lead.email}-${idx}`}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">
                            {lead.name} <span className="text-zinc-400">({lead.email})</span>
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(lead.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge
                          className={
                            lead.consent
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                              : 'border-red-500/30 bg-red-500/10 text-red-200'
                          }
                        >
                          consent: {lead.consent ? 'yes' : 'no'}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No signups yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">Registered users</CardTitle>
                  <Button variant="secondary" size="sm" onClick={() => void loadUsers()} disabled={usersLoading}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {users.length ? (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <UserRow key={user.id} user={user} onUpdated={loadUsers} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No users returned.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

function UserRow({
  user,
  onUpdated,
}: {
  user: ClerkUserRow;
  onUpdated: () => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const updateSubscription = async (patch: { plan?: string; status?: string }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/bo/users/${encodeURIComponent(user.id)}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok !== true) throw new Error(payload?.error || 'update_failed');
      toast.success('Updated');
      await onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'update_failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{user.email}</p>
          <p className="mt-1 text-xs text-zinc-500">
            created: {new Date(user.createdAt).toLocaleDateString()} • last sign-in:{' '}
            {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : '—'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
            defaultValue={user.subscriptionPlan || 'free'}
            disabled={saving}
            onChange={(e) => void updateSubscription({ plan: e.target.value })}
          >
            <option value="free">free</option>
            <option value="starter">starter</option>
            <option value="pro">pro</option>
            <option value="agency">agency</option>
          </select>
          <select
            className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
            defaultValue={user.subscriptionStatus || 'inactive'}
            disabled={saving}
            onChange={(e) => void updateSubscription({ status: e.target.value })}
          >
            <option value="inactive">inactive</option>
            <option value="trial">trial</option>
            <option value="active">active</option>
            <option value="past_due">past_due</option>
            <option value="canceled">canceled</option>
          </select>
        </div>
      </div>
    </div>
  );
}
