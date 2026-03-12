'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { IntegrationStatusItem } from '@/lib/types';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

const docs: Record<string, string> = {
  clerk: 'Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env.local, then restart app.',
  openai: 'Set OPENAI_API_KEY (server-only). Analysis API will use live provider when mock mode is disabled.',
  ubereats: 'Uber Eats integration requires developer credentials. Apply at https://developer.uber.com/docs/eats and configure UBEREATS_CLIENT_ID and UBEREATS_CLIENT_SECRET in .env.local. After approval, click "Authorize" to complete OAuth flow and access real order data.',
  doordash: 'DoorDash OAuth/API integration is pending. Use Connect to create a connected-channel placeholder and complete production API onboarding later.',
  grubhub: 'Grubhub OAuth/API integration is pending. Use Connect to create a connected-channel placeholder and complete production API onboarding later.',
  fantuan: 'Fantuan OAuth/API integration is pending. Use Connect to create a connected-channel placeholder and complete production API onboarding later.',
  hungrypanda: 'HungryPanda OAuth/API integration is pending. Use Connect to create a connected-channel placeholder and complete production API onboarding later.',
  facebook: 'Set META_APP_ID, META_APP_SECRET, and META_GRAPH_VERSION in .env.local, then click Connect Facebook to start OAuth.',
  instagram: 'Set META_APP_ID, META_APP_SECRET, and META_GRAPH_VERSION in .env.local, then click Connect Instagram. The Instagram account must be Professional and linked to a Facebook Page.',
  googleBusiness: 'Set GOOGLE_BUSINESS_CLIENT_ID and GOOGLE_BUSINESS_CLIENT_SECRET in .env.local, configure Google OAuth redirect URI, then click Connect Google Business. The Google Cloud project must be approved for Business Profile APIs.',
  yelp: 'Set YELP_API_KEY (server-only). /api/integrations/yelp will return live review metadata when configured.',
  yelpPartner: 'Yelp owner-account connection and reply/post management require Yelp Partner approval plus partner OAuth credentials. The public Fusion API key only supports business lookup and review metadata.',
  googleMaps: 'Set GOOGLE_MAPS_API_KEY (server-only) for Places/Geocoding server calls.',
  mapbox: 'Set NEXT_PUBLIC_MAPBOX_API_KEY for future map UI previews in dashboard and territory analysis.',
};

const deliveryPlatformKeys = new Set([
  'ubereats',
  'doordash',
  'grubhub',
  'fantuan',
  'hungrypanda',
]);

const oauthKeys = new Set(['facebook', 'instagram', 'googleBusiness']);

export function IntegrationStatusPanel({
  items,
  onTest,
  testingKey,
}: {
  items: IntegrationStatusItem[];
  onTest: (key: IntegrationStatusItem['key']) => Promise<unknown>;
  testingKey: string | null;
}) {
  const { copy, lang } = useDashboardLanguage();
  const [docKey, setDocKey] = useState<string | null>(null);
  const docsLocalized = lang === 'zh'
    ? {
        clerk: '在 .env.local 配置 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY 与 CLERK_SECRET_KEY，然后重启应用。',
        openai: '配置 OPENAI_API_KEY（仅服务端）。关闭 mock 模式后分析接口会优先尝试实时调用。',
        ubereats: 'Uber Eats 集成需要开发者凭证。请访问 https://developer.uber.com/docs/eats 申请开发者权限，然后在 .env.local 中配置 UBEREATS_CLIENT_ID 和 UBEREATS_CLIENT_SECRET。获得批准后，点击"授权接入"完成 OAuth 流程，即可访问实时订单数据。',
        doordash: 'DoorDash OAuth/API 还未完成正式对接。当前可先点击连接，建立平台连接占位并在后续切换到正式授权流程。',
        grubhub: 'Grubhub OAuth/API 还未完成正式对接。当前可先点击连接，建立平台连接占位并在后续切换到正式授权流程。',
        fantuan: 'Fantuan OAuth/API 还未完成正式对接。当前可先点击连接，建立平台连接占位并在后续切换到正式授权流程。',
        hungrypanda: 'HungryPanda OAuth/API 还未完成正式对接。当前可先点击连接，建立平台连接占位并在后续切换到正式授权流程。',
        facebook: '配置 META_APP_ID、META_APP_SECRET、META_GRAPH_VERSION（仅服务端），然后点击"连接 Facebook"发起授权。',
        instagram: '配置 META_APP_ID、META_APP_SECRET、META_GRAPH_VERSION（仅服务端），然后点击"连接 Instagram"。Instagram 必须是 Professional 账号并绑定 Facebook Page。',
        googleBusiness: '配置 GOOGLE_BUSINESS_CLIENT_ID、GOOGLE_BUSINESS_CLIENT_SECRET（仅服务端），在 Google Cloud 中配置 OAuth 回调地址，然后点击"连接 Google Business"。Google Cloud 项目还需要获得 Business Profile API 访问资格。',
        yelp: '配置 YELP_API_KEY（仅服务端）。/api/integrations/yelp 在配置后会返回实时 Yelp 数据。',
        yelpPartner: 'Yelp 商家账号授权、回复和统一托管需要 Yelp Partner 审批和 Partner OAuth 凭证。仅有公开 Fusion API Key 无法连接商家所有者账号。',
        googleMaps: '配置 GOOGLE_MAPS_API_KEY（仅服务端）用于 Geocoding / Places 调用。',
        mapbox: '配置 NEXT_PUBLIC_MAPBOX_API_KEY 用于后续地图 UI 预览。',
      }
    : docs;
  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">{copy.settings.integrationStatus.title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-100">{item.label}</p>
                    <Badge className={item.status === 'connected' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : item.status === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'}>{copy.settings.integrationStatus.statuses[item.status]}</Badge>
                  </div>
                  <p className="text-xs text-zinc-400">{item.detail}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{copy.settings.integrationStatus.lastTested}: {item.lastTestedAt ? new Date(item.lastTestedAt).toLocaleString() : copy.settings.integrationStatus.never}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={testingKey === item.key} onClick={() => onTest(item.key)}>{testingKey === item.key ? copy.common.testing : copy.common.testConnection}</Button>
                  {deliveryPlatformKeys.has(item.key) ? (
                    <Button
                      variant={item.status === 'connected' ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        if (item.status === 'connected') {
                          window.location.href = `/api/integrations/delivery-platform/disconnect?platform=${encodeURIComponent(item.key)}`;
                          return;
                        }
                        if (item.key === 'ubereats') {
                          window.location.href = '/api/integrations/ubereats/start?next=%2F';
                          return;
                        }
                        window.location.href = `/api/integrations/delivery-platform/start?platform=${encodeURIComponent(item.key)}`;
                      }}
                    >
                      {lang === 'zh'
                        ? item.status === 'connected'
                          ? '取消连接'
                          : '授权接入'
                        : item.status === 'connected'
                          ? 'Disconnect'
                          : 'Authorize'}
                    </Button>
                  ) : null}
                  {oauthKeys.has(item.key) ? (
                    <Button
                      variant={item.status === 'connected' ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        if (item.key === 'googleBusiness') {
                          window.location.href = '/api/integrations/google-business/start';
                          return;
                        }
                        window.location.href = `/api/integrations/meta/start?provider=${item.key}`;
                      }}
                    >
                      {lang === 'zh' ? (
                        item.status === 'connected'
                          ? item.key === 'googleBusiness'
                            ? '重新连接 Google Business'
                            : `重新连接${item.key === 'facebook' ? ' Facebook' : ' Instagram'}`
                          : item.key === 'googleBusiness'
                            ? '连接 Google Business'
                            : `连接${item.key === 'facebook' ? ' Facebook' : ' Instagram'}`
                      ) : item.status === 'connected' ? (
                        item.key === 'googleBusiness'
                          ? 'Reconnect Google Business'
                          : `Reconnect ${item.key === 'facebook' ? 'Facebook' : 'Instagram'}`
                      ) : (
                        item.key === 'googleBusiness'
                          ? 'Connect Google Business'
                          : `Connect ${item.key === 'facebook' ? 'Facebook' : 'Instagram'}`
                      )}
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => setDocKey(item.key)}>{copy.common.viewSetup}</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Modal open={Boolean(docKey)} onOpenChange={(open) => !open && setDocKey(null)} title={copy.settings.integrationStatus.setupGuideTitle}>
        <p className="text-sm text-zinc-300">{docKey ? docsLocalized[docKey] : ''}</p>
      </Modal>
    </>
  );
}