import Link from 'next/link';

export default function PrivacyPage() {
  const updatedAt = 'March 5, 2026';

  return (
    <main className="min-h-screen bg-black px-6 py-14 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Restaurant IQ</p>
          <h1 className="text-3xl font-semibold md:text-4xl">Privacy Policy / 隐私政策</h1>
          <p className="text-sm text-zinc-400">Last updated: {updatedAt}</p>
        </header>

        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
          <h2 className="text-xl font-semibold">1. Information We Collect / 我们收集的信息</h2>
          <p className="text-sm leading-7 text-zinc-300">
            We collect account information (name, email), restaurant profile data, and operational
            data uploaded or connected by authorized users to provide analytics and execution
            features. 我们会收集账户信息（姓名、邮箱）、餐厅配置数据，以及由授权用户上传或接入的运营数据，
            用于提供分析与执行功能。
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
          <h2 className="text-xl font-semibold">2. How We Use Data / 数据用途</h2>
          <p className="text-sm leading-7 text-zinc-300">
            Data is used to generate recommendations, monitor performance, and support user-approved
            operational actions. We do not sell customer data. 数据仅用于生成经营建议、监控表现并支持用户确认后的执行动作。
            我们不会出售客户数据。
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
          <h2 className="text-xl font-semibold">3. Data Security / 数据安全</h2>
          <p className="text-sm leading-7 text-zinc-300">
            We apply access control, server-side secret management, and audit trails for execution
            actions. Sensitive API secrets are not exposed to frontend clients. 我们采用权限控制、服务端密钥管理与执行审计，
            并确保敏感密钥不会暴露在前端。
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
          <h2 className="text-xl font-semibold">4. Third-Party Integrations / 第三方集成</h2>
          <p className="text-sm leading-7 text-zinc-300">
            When you connect third-party platforms (such as Uber Eats, Meta, Google, Yelp), we only
            access and process data required to provide requested features and within granted
            permissions. 当你接入 Uber Eats、Meta、Google、Yelp 等第三方平台时，我们仅在授权范围内读取并处理必要数据。
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
          <h2 className="text-xl font-semibold">5. Contact / 联系方式</h2>
          <p className="text-sm leading-7 text-zinc-300">
            For privacy-related requests, contact:
            <a
              href="mailto:support@restaurantiq.ai"
              className="ml-1 text-orange-300 underline underline-offset-2"
            >
              support@restaurantiq.ai
            </a>
          </p>
        </section>

        <div className="pt-2 text-sm text-zinc-400">
          <Link href="/" className="text-orange-300 underline underline-offset-2">
            Back to Home / 返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}

