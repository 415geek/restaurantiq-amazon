import { auth } from '@clerk/nextjs/server';
import { BillingAccessClient } from '@/components/dashboard/BillingAccessClient';

const authDisabled = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default async function BillingAccessPage() {
  if (authDisabled) return <BillingAccessClient authDisabled hasProPlan={false} hasSocialAiReply={false} />;

  const { has } = await auth();
  const hasProPlan = has({ plan: 'pro' });
  const hasSocialAiReply = has({ feature: 'social_ai_reply' });

  return <BillingAccessClient authDisabled={false} hasProPlan={hasProPlan} hasSocialAiReply={hasSocialAiReply} />;
}
