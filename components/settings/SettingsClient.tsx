'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { defaultSettings, integrationStatusMock } from '@/lib/mock-data';
import type { SettingsState } from '@/lib/types';
import { RestaurantProfileForm } from '@/components/settings/RestaurantProfileForm';
import { AgentTogglePanel } from '@/components/settings/AgentTogglePanel';
import { ExecutionPolicyPanel } from '@/components/settings/ExecutionPolicyPanel';
import { ModelRoutingConfig } from '@/components/settings/ModelRoutingConfig';
import { IntegrationStatusPanel } from '@/components/settings/IntegrationStatusPanel';
import { useIntegrationStatus } from '@/hooks/useIntegrationStatus';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

const STORAGE_KEY = 'iqproject.settings.v1';

export function SettingsClient() {
  const { copy, lang } = useDashboardLanguage();
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const integrations = useIntegrationStatus(integrationStatusMock);
  const { items, testingKey, test, setItems } = integrations;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/integrations/meta/status', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!mounted || !data) return;
        setItems((prev) =>
          prev.map((item) => {
            if (item.key === 'facebook') {
              const connected = Boolean(data.facebook?.connected);
              const count = Array.isArray(data.facebook?.pages) ? data.facebook.pages.length : 0;
              return {
                ...item,
                status: connected ? 'connected' : (data.configured ? 'missing' : 'missing'),
                lastTestedAt: data.timestamp ?? item.lastTestedAt,
                detail: connected
                  ? `${count} Facebook Page(s) connected via Meta OAuth.`
                  : data.configured
                    ? 'Meta app configured. Click Connect Facebook to authorize a Page.'
                    : 'META_APP_ID / META_APP_SECRET not configured yet.',
              };
            }
            if (item.key === 'instagram') {
              const connected = Boolean(data.instagram?.connected);
              const count = Array.isArray(data.instagram?.accounts) ? data.instagram.accounts.length : 0;
              return {
                ...item,
                status: connected ? 'connected' : (data.configured ? 'missing' : 'missing'),
                lastTestedAt: data.timestamp ?? item.lastTestedAt,
                detail: connected
                  ? `${count} Instagram Professional account(s) connected via Meta OAuth.`
                  : data.configured
                    ? 'Meta app configured. Click Connect Instagram to authorize an Instagram Professional account.'
                    : 'META_APP_ID / META_APP_SECRET not configured yet.',
              };
            }
            return item;
          })
        );
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [setItems]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/integrations/google-business/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        setItems((prev) =>
          prev.map((item) => {
            if (item.key !== 'googleBusiness') return item;
            const connected = Boolean(data.googleBusiness?.connected);
            const locationCount = Array.isArray(data.googleBusiness?.locations)
              ? data.googleBusiness.locations.length
              : 0;
            return {
              ...item,
              status: connected ? 'connected' : 'missing',
              lastTestedAt: data.timestamp ?? item.lastTestedAt,
              detail: connected
                ? `${locationCount} Google Business location(s) connected via OAuth.`
                : data.configured
                  ? 'Google Business OAuth configured. Click Connect Google Business to authorize a Business Profile account.'
                  : 'GOOGLE_BUSINESS_CLIENT_ID / GOOGLE_BUSINESS_CLIENT_SECRET not configured yet.',
            };
          })
        );
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [setItems]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/integrations/ubereats/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        setItems((prev) =>
          prev.map((item) => {
            if (item.key !== 'ubereats') return item;
            const connected = Boolean(data.ubereats?.connected);
            const needsReconnect = Boolean(data.ubereats?.needsReconnect);
            const storeCount = Array.isArray(data.ubereats?.stores)
              ? data.ubereats.stores.length
              : 0;
            const detail = connected
              ? (lang === 'zh'
                  ? `已连接 ${storeCount} 个 Uber Eats 门店。Agent A 会优先拉取 Uber Eats 订单快照，同时保留上传文件 fallback。`
                  : `${storeCount} Uber Eats store(s) connected. Agent A can ingest Uber Eats snapshots while keeping upload fallback.`)
              : needsReconnect
                ? (lang === 'zh'
                    ? 'Uber Eats 授权状态已过期（或服务重启后 token 丢失）。请点击 Connect Uber Eats 重新授权。'
                    : 'Uber Eats authorization is stale (or token state was lost after restart). Reconnect Uber Eats to continue live ingestion.')
              : data.configured
                ? (lang === 'zh'
                    ? 'Uber Eats 集成已配置。点击 Connect Uber Eats 完成授权，或使用服务端 token 模式。'
                    : 'Uber Eats integration is configured. Click Connect Uber Eats to authorize, or use server-token mode.')
                : (lang === 'zh'
                    ? 'UBEREATS_CLIENT_ID / UBEREATS_CLIENT_SECRET（或 UBEREATS_BEARER_TOKEN）尚未配置。'
                    : 'UBEREATS_CLIENT_ID / UBEREATS_CLIENT_SECRET (or UBEREATS_BEARER_TOKEN) is not configured.');
            return {
              ...item,
              status: connected ? 'connected' : 'missing',
              lastTestedAt: data.timestamp ?? item.lastTestedAt,
              detail,
            };
          })
        );
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [lang, setItems]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/delivery/management', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data || !Array.isArray(data.platforms)) return;
        setItems((prev) =>
          prev.map((item) => {
            if (
              item.key !== 'doordash' &&
              item.key !== 'grubhub' &&
              item.key !== 'fantuan' &&
              item.key !== 'hungrypanda'
            ) {
              return item;
            }
            const platform = data.platforms.find(
              (entry: { key?: string }) => entry.key === item.key
            ) as
              | {
                  key: string;
                  label: string;
                  status: 'connected' | 'not_connected' | 'issue';
                  queueSize?: number;
                  menuSyncedAt?: string;
                  acceptsOrders?: boolean;
                }
              | undefined;

            if (!platform) return item;

            const status =
              platform.status === 'connected'
                ? 'connected'
                : platform.status === 'issue'
                  ? 'error'
                  : 'missing';
            const detail =
              lang === 'zh'
                ? status === 'connected'
                  ? `${platform.label} 已连接。当前队列 ${platform.queueSize ?? 0}，${
                      platform.acceptsOrders ? '接单已开启' : '接单已关闭'
                    }。`
                  : `${platform.label} 未连接。点击“授权接入”后会跳转至订单中心。`
                : status === 'connected'
                  ? `${platform.label} is connected. Queue ${platform.queueSize ?? 0}, ${
                      platform.acceptsOrders ? 'accepting orders' : 'intake paused'
                    }.`
                  : `${platform.label} is not connected. Click Authorize to connect and return to Order Center.`;

            return {
              ...item,
              status,
              detail,
              lastTestedAt: data.updatedAt ?? item.lastTestedAt,
            };
          })
        );
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [lang, setItems]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const provider = url.searchParams.get('meta_provider');
    const status = url.searchParams.get('meta_status');
    const errorDescription = url.searchParams.get('meta_error_description');
    const connectedCount = url.searchParams.get('meta_connected_count');
    if (!provider || !status) return;
    if (status === 'connected') {
      toast.success(
        provider === 'instagram'
          ? `Instagram connected${connectedCount ? ` (${connectedCount})` : ''}`
          : `Facebook connected${connectedCount ? ` (${connectedCount})` : ''}`
      );
    } else {
      toast.error(errorDescription || `Meta ${provider} connection failed`);
    }
    ['meta_provider', 'meta_status', 'meta_error', 'meta_error_description', 'meta_connected_count'].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState({}, '', url.toString());
  }, [toast]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('google_business_status');
    const error = url.searchParams.get('google_business_error');
    const connectedCount = url.searchParams.get('google_business_connected_count');
    if (!status) return;
    if (status === 'connected') {
      toast.success(`Google Business connected${connectedCount ? ` (${connectedCount})` : ''}`);
    } else {
      toast.error(error || 'Google Business connection failed');
    }
    ['google_business_status', 'google_business_error', 'google_business_connected_count'].forEach((k) =>
      url.searchParams.delete(k)
    );
    window.history.replaceState({}, '', url.toString());
  }, [toast]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('ubereats_status');
    const error = url.searchParams.get('ubereats_error');
    const connectedCount = url.searchParams.get('ubereats_connected_count');
    if (!status) return;
    if (status === 'connected') {
      toast.success(
        lang === 'zh'
          ? `Uber Eats 已连接${connectedCount ? `（${connectedCount}）` : ''}`
          : `Uber Eats connected${connectedCount ? ` (${connectedCount})` : ''}`
      );
    } else {
      toast.error(error || (lang === 'zh' ? 'Uber Eats 连接失败' : 'Uber Eats connection failed'));
    }
    ['ubereats_status', 'ubereats_error', 'ubereats_connected_count'].forEach((k) =>
      url.searchParams.delete(k)
    );
    window.history.replaceState({}, '', url.toString());
  }, [lang, toast]);

  const saveAll = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      await new Promise((r) => setTimeout(r, 350));
      toast.success(copy.settingsPage.saveToast);
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setSettings(defaultSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
    toast.info(copy.settingsPage.restoreToast);
  };

  if (!loaded) {
    return <div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.settingsPage.title}
        description={copy.settingsPage.description}
        badge={copy.settingsPage.badge}
        actions={(
          <>
            <Button variant="ghost" onClick={resetDefaults}><RotateCcw className="h-4 w-4" /> {copy.settingsPage.restoreDefaults}</Button>
            <Button onClick={saveAll} disabled={saving}><Save className="h-4 w-4" /> {saving ? copy.settingsPage.savingAll : copy.settingsPage.saveAll}</Button>
          </>
        )}
      />

      <RestaurantProfileForm value={settings.restaurantProfile} onSave={(restaurantProfile) => { setSettings((prev) => ({ ...prev, restaurantProfile })); toast.success(copy.settings.profileSaved); }} />
      <AgentTogglePanel value={settings.agentConfig} onChange={(agentConfig) => setSettings((prev) => ({ ...prev, agentConfig }))} />
      <ExecutionPolicyPanel value={settings.executionPolicy} onChange={(executionPolicy) => setSettings((prev) => ({ ...prev, executionPolicy }))} />
      <ModelRoutingConfig value={settings.modelRouting} onChange={(modelRouting) => setSettings((prev) => ({ ...prev, modelRouting }))} />
      <IntegrationStatusPanel items={items} testingKey={testingKey} onTest={async (key) => { const res = await test(key); toast.info(`${copy.settingsPage.testedToastPrefix} ${key}`); return res; }} />
    </div>
  );
}
