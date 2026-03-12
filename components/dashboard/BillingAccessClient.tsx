'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

type Props = {
  authDisabled: boolean;
  hasProPlan: boolean;
  hasSocialAiReply: boolean;
};

export function BillingAccessClient({ authDisabled, hasProPlan, hasSocialAiReply }: Props) {
  const { copy } = useDashboardLanguage();

  if (authDisabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-100">{copy.billingAccess.title}</h1>
        <Card>
          <CardHeader><CardTitle>{copy.billingAccess.authDisabledTitle}</CardTitle></CardHeader>
          <CardContent className="text-sm text-zinc-300">{copy.billingAccess.authDisabledBody}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">{copy.billingAccess.title}</h1>
        <p className="mt-1 text-sm text-zinc-400">{copy.billingAccess.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{copy.billingAccess.planCheck}</CardTitle>
            <Badge className={hasProPlan ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'}>
              {hasProPlan ? copy.billingAccess.hasPro : copy.billingAccess.noPro}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-300">
            <p>Code: <code>const hasProPlan = has({'{'} plan: 'pro' {'}'})</code></p>
            <p>{hasProPlan ? copy.billingAccess.proGranted : copy.billingAccess.proDenied}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{copy.billingAccess.featureCheck}</CardTitle>
            <Badge className={hasSocialAiReply ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'}>
              {hasSocialAiReply ? copy.billingAccess.featureOn : copy.billingAccess.featureOff}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-300">
            <p>Code: <code>const hasSocialAiReply = has({'{'} feature: 'social_ai_reply' {'}'})</code></p>
            <p>{hasSocialAiReply ? copy.billingAccess.socialReplyGranted : copy.billingAccess.socialReplyDenied}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{copy.billingAccess.proProtectedTitle}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-300">
            <div>{copy.billingAccess.proProtectedBody}</div>
            {!hasProPlan ? (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-200">{copy.billingAccess.proFallbackBody}</div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{copy.billingAccess.featureProtectedTitle}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-300">
            <div>{copy.billingAccess.featureProtectedBody}</div>
            {!hasSocialAiReply ? (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-200">{copy.billingAccess.featureFallbackBody}</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
