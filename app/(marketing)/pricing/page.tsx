import type { Metadata } from 'next';
import Link from 'next/link';
import { PricingTable } from '@clerk/nextjs';
import { marketingContent } from '@/lib/marketing-content';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const metadata: Metadata = {
  title: 'Pricing | Restaurant IQ',
  description: 'Restaurant IQ pricing plans for AI-driven restaurant operations and execution workflows.',
};

function PricingFallback() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {marketingContent.pricing.map((plan, idx) => (
        <div
          key={plan.name}
          className={[
            'rounded-2xl border bg-zinc-900/80 p-6 shadow-sm',
            idx === 1 ? 'border-orange-500/40 ring-1 ring-orange-500/20' : 'border-zinc-800',
          ].join(' ')}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">{plan.name}</h2>
            {idx === 1 ? <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs text-orange-300">Popular</span> : null}
          </div>
          <p className="mb-5 text-2xl font-bold text-white">{plan.price}</p>
          <ul className="space-y-2 text-sm text-zinc-300">
            {plan.features.map((feature) => (
              <li key={feature} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <Link
              href="/sign-up"
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#F26A36] px-4 text-sm font-semibold text-white hover:bg-[#ff7a48]"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const showClerkPricing = !isMockMode && isClerkConfigured;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
            Pricing
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Restaurant IQ Pricing</h1>
          <p className="mx-auto max-w-2xl text-sm text-zinc-400 sm:text-base">
            Choose a plan for AI-powered restaurant analytics, execution workflows, and rollback-safe automation.
          </p>
        </div>

        {showClerkPricing ? (
          <div className="mx-auto max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-6">
            <PricingTable />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-100">
              {isMockMode
                ? 'Mock mode is enabled. Showing local pricing cards instead of Clerk billing plans.'
                : 'Clerk PricingTable requires Clerk to be configured. Showing local pricing cards for now.'}
            </div>
            <PricingFallback />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/sign-up" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#F26A36] px-4 text-sm font-semibold text-white hover:bg-[#ff7a48]">
            Start Free Trial
          </Link>
          <Link href="/" className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-700 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-900">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
