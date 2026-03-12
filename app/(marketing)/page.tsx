"use client";

import { motion } from 'framer-motion';
import { CheckCircle, Zap, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

type Language = 'zh' | 'en';

type DemoRequestForm = {
  name: string;
  email: string;
};

function WorkflowStepPreview({
  step,
  lang,
  onOpen,
}: {
  step: number;
  lang: Language;
  onOpen?: (payload: { src: string; alt: string }) => void;
}) {
  const moduleLabels: Record<number, { zh: string; en: string }> = {
    1: { zh: 'Dashboard', en: 'Dashboard' },
    2: { zh: 'Analysis', en: 'Analysis' },
    3: { zh: 'Execution', en: 'Execution' },
    4: { zh: 'Execution', en: 'Execution' },
    5: { zh: 'Social Radar', en: 'Social Radar' },
    6: { zh: 'Social Radar', en: 'Social Radar' },
    7: { zh: 'Inventory', en: 'Inventory' },
  };
  const screenshots: Record<number, { src: string; altZh: string; altEn: string }> = {
    1: {
      src: '/marketing/workflow/step-1-operations-overview.png',
      altZh: '运营概况截图',
      altEn: 'Operations overview screenshot',
    },
    2: {
      src: '/marketing/workflow/step-2-ai-recommendations.png',
      altZh: 'AI 建议截图',
      altEn: 'AI recommendations screenshot',
    },
    3: {
      src: '/marketing/workflow/step-3-swipe-confirm-execution.png',
      altZh: '滑动确认执行截图',
      altEn: 'Swipe-to-confirm execution screenshot',
    },
    4: {
      src: '/marketing/workflow/step-4-fast-rollback.png',
      altZh: '执行后的快速回滚截图',
      altEn: 'Post-execution rollback screenshot',
    },
    5: {
      src: '/marketing/workflow/step-5-social-monitoring.png',
      altZh: '自媒体内容实时监控截图',
      altEn: 'Real-time social media monitoring screenshot',
    },
    6: {
      src: '/marketing/workflow/step-6-social-reply.png',
      altZh: '自媒体账号一键回复截图',
      altEn: 'One-click social account reply screenshot',
    },
  };

  const label = moduleLabels[step];
  const shot = screenshots[step];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#090a0f] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black h-[180px] sm:h-[220px] md:h-[280px] lg:h-[320px]">
        <div className="absolute left-3 top-3 z-20 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11px] font-medium tracking-wide text-zinc-200 backdrop-blur">
          {lang === 'zh' ? label.zh : label.en}
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/15 via-transparent to-white/5" />
        {shot ? (
          <img
            src={shot.src}
            alt={lang === 'zh' ? shot.altZh : shot.altEn}
            className="block h-full w-full cursor-zoom-in object-cover object-top transition-transform duration-300 hover:scale-[1.01]"
            loading="lazy"
            onClick={() =>
              onOpen?.({
                src: shot.src,
                alt: lang === 'zh' ? shot.altZh : shot.altEn,
              })
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(242,106,54,0.18),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.06),transparent_45%)]">
            <div className="rounded-2xl border border-[#F26A36]/30 bg-[#F26A36]/10 px-6 py-4 text-center shadow-[0_0_0_1px_rgba(242,106,54,0.12)]">
              <div className="text-xs uppercase tracking-[0.18em] text-[#F7A27D]">
                {lang === 'zh' ? '即将上线' : 'Coming Soon'}
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {lang === 'zh' ? '供应链库存管理模块' : 'Supply Chain & Inventory'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const contentByLang = {
  zh: {
    nav: {
      signIn: '登录',
      getStarted: '开始使用',
      toggle: 'EN',
      toggleAria: '切换语言',
    },
    hero: {
      title: '餐饮 AI 的下一站，不是洞察，是执行。',
      subtitle:
        '不只是分析报表，而是直接给出建议并安全执行。Restaurant IQ 是面向北美餐饮经营者的智能运营 Agent 平台，适用于堂食、外卖与多门店场景。',
      ctaPrimary: 'Start Free Trial',
      ctaSecondary: 'Amazon Nova AI Hackathon Demo',
      tags: ['AI Agent', '可回滚自动执行', '7/24 客服'],
    },
    socialProof: [
      '适用于堂食 + 外卖餐厅',
      '支持多平台数据整合 (DoorDash / UberEats / Grubhub / 熊猫外卖 / 饭团外卖)',
      '双语支持',
      '自媒体雷达',
    ],
    problem: {
      title: '还在凭感觉做决策？',
      items: [
        {
          title: '数据分散',
          desc: 'POS、外卖平台、社媒、评论分散在多个系统，每天花大量时间对账。',
        },
        {
          title: '决策滞后',
          desc: '等到月底看财报才发现某道菜不赚钱，或者某个平台的单量已经大幅下滑。',
        },
      ],
    },
    solution: {
      title: 'Restaurant IQ 的解法',
      items: ['多源数据统一整合监控', 'AI 发现趋势并主动推送建议', '一键授权，Agent 自动执行改价/活动'],
    },
    safety: {
      title: '我们把"安全可控"做成了核心交互',
      subtitle: '不盲目自动化。每一步高风险操作，都在你的掌控之中。',
      workflow: [
        { step: 1, title: '运营概况', description: '统一查看营收、订单、评分、配送占比与融合分析摘要。' },
        { step: 2, title: 'AI 建议', description: '按影响力、紧急度、可行性排序，给出优先执行动作。' },
        { step: 3, title: '滑动确认执行', description: '先预览执行参数，再通过滑动确认触发高风险动作。' },
        { step: 4, title: '快速回滚', description: '执行后提供回滚窗口，降低自动化操作风险。' },
        { step: 5, title: '自媒体内容实时监控', description: '实时追踪外部博主提及、互动量与传播热度变化。' },
        { step: 6, title: '自媒体账号一键回复', description: '聚合评论与私信反馈，支持 AI 草拟与一键发送回复。' },
        { step: 7, title: '供应链库存管理', description: '实时监控食材库存，AI 自动下单，并可配置人工二次确认后执行。' },
      ],
    },
    pricing: {
      title: 'Pricing Plans',
      plans: [
        { name: 'Starter', price: 'Contact Us', features: ['基础数据看板', '每日 10 次分析', '无自动执行'] },
        { name: 'Pro', price: 'Contact Us', features: ['全套 Agent', '不限次分析', '自动执行与回滚'] },
        { name: 'Agency', price: 'Contact Us', features: ['多门店管理', '专属架构师', '定制化模型'] },
      ],
      choosePrefix: 'Choose',
    },
    finalCta: {
      title: '今天就让 AI 为你的餐厅打工',
      subtitle: '无需更换现有 POS 系统，快速接入，首月免费体验。',
      button: 'Start Free Trial',
    },
    modal: {
      title: 'Amazon Nova AI Hackathon Demo',
      subtitle: 'Enter your name and email to access the complete demo system and experience all features.',
      placeholders: {
        name: 'Your name',
        email: 'Email address',
      },
      submit: 'Enter Demo',
      submitting: 'Entering...',
      validation: {
        required: 'Required',
        email: 'Invalid email format',
      },
      toast: {
        loading: 'Entering demo...',
        success: 'Welcome to Amazon Nova AI Hackathon Demo!',
        error: 'Failed to enter. Please try again.',
      },
    },
    footer: {
      builtWith: 'Build with ❤️ in San Francisco',
      supportLabel: 'Support',
    },
  },
  en: {
    nav: {
      signIn: 'Sign In',
      getStarted: 'Get Started',
      toggle: '中',
      toggleAria: 'Toggle language',
    },
    hero: {
      title: "The next frontier of restaurant AI isn't insights — it's execution.",
      subtitle:
        'More than analytics dashboards, Restaurant IQ turns signals into recommendations and safe execution. Built for restaurant operators across North America, from independent stores to multi-location teams.',
      ctaPrimary: 'Start Free Trial',
      ctaSecondary: 'Amazon Nova AI Hackathon Demo',
      tags: ['AI Agent', 'Rollback-enabled Automation', '24/7 Support'],
    },
    socialProof: [
      'Built for dine-in + delivery restaurants',
      'Supports multi-platform ops (DoorDash / Uber Eats / Yelp)',
      'Bilingual support',
      'Designed for North American Chinese restaurants',
    ],
    problem: {
      title: 'Still making decisions by instinct?',
      items: [
        {
          title: 'Fragmented data',
          desc: 'POS, delivery platforms, social media, and reviews live in different systems, forcing hours of manual reconciliation.',
        },
        {
          title: 'Delayed decisions',
          desc: 'By the time monthly reports arrive, a dish may already be unprofitable or a delivery channel may have already dropped sharply.',
        },
      ],
    },
    solution: {
      title: 'How Restaurant IQ fixes it',
      items: ['Unified monitoring across data sources', 'AI detects trends and pushes recommendations', 'One-click approval for agent-driven pricing and promos'],
    },
    safety: {
      title: 'Safety and control are built into the core interaction',
      subtitle: 'No blind automation. Every high-risk action stays under your control.',
      workflow: [
        { step: 1, title: 'Operations Overview', description: 'See revenue, orders, ratings, delivery mix, and fused analysis summaries in one place.' },
        { step: 2, title: 'AI Recommendations', description: 'Ranked by impact, urgency, and feasibility to prioritize execution.' },
        { step: 3, title: 'Swipe-to-Confirm Execution', description: 'Preview execution parameters, then confirm high-risk actions with a swipe.' },
        { step: 4, title: 'Fast Rollback', description: 'A rollback window reduces risk after actions are executed.' },
        { step: 5, title: 'Real-time Social Monitoring', description: 'Track creator mentions, engagement metrics, and social momentum as it happens.' },
        { step: 6, title: 'One-click Social Replies', description: 'Centralize comment handling with AI-assisted drafts and one-click replies.' },
        { step: 7, title: 'Supply Chain Inventory Management', description: 'Monitor ingredient inventory in real time, automate purchase orders, and require optional human confirmation before execution.' },
      ],
    },
    pricing: {
      title: 'Pricing Plans',
      plans: [
        { name: 'Starter', price: 'Contact Us', features: ['Basic analytics dashboard', '10 analyses per day', 'No auto-execution'] },
        { name: 'Pro', price: 'Contact Us', features: ['Full Agent suite', 'Unlimited analyses', 'Auto-execution + rollback'] },
        { name: 'Agency', price: 'Contact Us', features: ['Multi-store management', 'Dedicated solutions architect', 'Custom models'] },
      ],
      choosePrefix: 'Choose',
    },
    finalCta: {
      title: 'Put AI to work for your restaurant today',
      subtitle: 'No need to replace your existing POS. Connect quickly and start with a free trial.',
      button: 'Start Free Trial',
    },
    modal: {
      title: 'Book a Demo',
      subtitle: 'Leave your contact information and our consultant will walk you through the product.',
      placeholders: {
        name: 'Your name',
        email: 'Email address',
      },
      submit: 'Submit Request',
      submitting: 'Submitting...',
      validation: {
        required: 'Required',
        email: 'Invalid email format',
      },
      toast: {
        loading: 'Submitting...',
        success: 'We received your request and will contact you shortly!',
        error: 'Submission failed. Please try again.',
      },
    },
    footer: {
      builtWith: 'Build with ❤️ in San Francisco',
      supportLabel: 'Support',
    },
  },
} as const;

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return <div className={"bg-zinc-900 border border-zinc-800 rounded-2xl p-6 " + className}>{children}</div>;
};

const Button = ({ children, className = '', variant = 'primary', ...props }: any) => {
  const base = 'inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors h-12 px-8';
  const variantClass =
    variant === 'primary'
      ? 'bg-[#F26A36] text-white hover:bg-[#F26A36]/90'
      : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700';
  return (
    <button className={base + ' ' + variantClass + ' ' + className} {...props}>
      {children}
    </button>
  );
};

function BookDemoModal({
  setIsOpen,
  copy,
  onSubmit,
}: {
  setIsOpen: (isOpen: boolean) => void;
  copy: any;
  onSubmit: (data: DemoRequestForm) => void;
}) {
  const demoRequestSchema = z.object({
    name: z.string().min(2, copy.validation.required),
    email: z.string().email(copy.validation.email),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DemoRequestForm>({
    resolver: zodResolver(demoRequestSchema),
  });

  const onFormSubmit = async (data: DemoRequestForm) => {
    await onSubmit(data);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold mb-2">{copy.title}</h3>
        <p className="text-zinc-400 mb-6 text-sm">{copy.subtitle}</p>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <input
              {...register('name')}
              placeholder={copy.placeholders.name}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#F26A36] rounded-xl px-4 py-3 text-white outline-none"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1 ml-1">{errors.name.message}</p>}
          </div>
          <div>
            <input
              {...register('email')}
              placeholder={copy.placeholders.email}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#F26A36] rounded-xl px-4 py-3 text-white outline-none"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1 ml-1">{errors.email.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full mt-2">
            {isSubmitting ? copy.submitting : copy.submit}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

export default function HomePage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('zh');
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const copy = contentByLang[language];

  const [typedHeroText, setTypedHeroText] = useState('');
  const [heroTypingDone, setHeroTypingDone] = useState(false);

  useEffect(() => {
    setTypedHeroText('');
    setHeroTypingDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setTypedHeroText(copy.hero.title.slice(0, i));
      if (i >= copy.hero.title.length) {
        clearInterval(timer);
        setHeroTypingDone(true);
      }
    }, 95);

    return () => clearInterval(timer);
  }, [copy.hero.title]);

  useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxImage(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxImage]);

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#F26A36] selection:text-white">
      {isDemoModalOpen && <BookDemoModal key={language} setIsOpen={setIsDemoModalOpen} copy={copy.modal} onSubmit={async (data) => {
        toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
          loading: copy.toast.loading,
          success: copy.toast.success,
          error: copy.toast.error,
        });
        setTimeout(() => setIsDemoModalOpen(false), 2000);
      }} />}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative w-full max-w-6xl rounded-2xl border border-white/10 bg-[#090a0f] p-3 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs text-zinc-200 hover:bg-black/80"
            >
              {language === 'zh' ? '关闭' : 'Close'}
            </button>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
              <img src={lightboxImage.src} alt={lightboxImage.alt} className="max-h-[82vh] w-full object-contain" />
            </div>
          </div>
        </div>
      )}

      <nav className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-white/5">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <img src="/branding/logo-mark.png" alt="Restaurant IQ logo" className="h-10 w-10 rounded-sm object-contain" />
          <img
            src="/branding/logo-wordmark.png"
            alt="Restaurant IQ"
            className="h-6 w-auto object-contain sm:h-8"
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh'))}
            className="text-xs md:text-sm px-2.5 sm:px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-zinc-200 whitespace-nowrap"
            aria-label={copy.nav.toggleAria}
          >
            {copy.nav.toggle}
          </button>
          <a href="/sign-in" className="text-xs sm:text-sm text-zinc-400 hover:text-white whitespace-nowrap">
            {copy.nav.signIn}
          </a>
          <a href="/sign-up" className="text-xs sm:text-sm bg-white/10 hover:bg-white/20 px-3 sm:px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
            {copy.nav.getStarted}
          </a>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 text-center max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center gap-3 mb-8 flex-wrap">
          {copy.hero.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full bg-[#F26A36]/10 text-[#F26A36] border border-[#F26A36]/20 text-sm font-medium"
            >
              {tag}
            </span>
          ))}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight"
        >
          <span>{typedHeroText}</span>
          {!heroTypingDone && (
            <span
              className="ml-1 inline-block h-[1em] w-[2px] bg-[#F26A36] align-[-0.1em] animate-pulse"
              aria-hidden="true"
            />
          )}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed"
        >
          {copy.hero.subtitle}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row justify-center gap-4"
        >
          <a
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors h-12 px-8 bg-[#F26A36] text-white hover:bg-[#F26A36]/90"
          >
            {copy.hero.ctaPrimary}
          </a>
          <Button variant="secondary" onClick={() => setIsDemoModalOpen(true)}>
            {copy.hero.ctaSecondary}
          </Button>
        </motion.div>
      </section>

      <section className="py-10 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-8 md:gap-16 text-zinc-500 font-medium">
          {copy.socialProof.map((proof) => (
            <span key={proof} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#F26A36]" /> {proof}
            </span>
          ))}
        </div>
      </section>

      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6">{copy.problem.title}</h2>
            <div className="space-y-6">
              {copy.problem.items.map((item) => (
                <div className="flex gap-4" key={item.title}>
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <span className="text-red-500 font-bold">X</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{item.title}</h4>
                    <p className="text-zinc-400 text-sm mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-[#F26A36]/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <Zap className="text-[#F26A36] w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-6 text-white">{copy.solution.title}</h3>
              <ul className="space-y-4">
                {copy.solution.items.map((item) => (
                  <li className="flex items-center gap-3" key={item}>
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center rounded-full border border-[#F26A36]/30 bg-[#F26A36]/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#F7A27D]">
              {language === 'zh' ? '核心功能亮点' : 'Core Product Highlights'}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{copy.safety.title}</h2>
            <p className="text-zinc-400">{copy.safety.subtitle}</p>
          </div>
          <div className="space-y-5">
            {copy.safety.workflow.map((w, idx) => (
              <motion.div
                key={w.step}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: idx * 0.06 }}
                className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]"
              >
                <Card className="h-full bg-[#0a0a0a] border-white/10 flex flex-col justify-center">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#F7A27D]">
                    {language === 'zh' ? '亮点' : 'Highlight'} 0{w.step}
                  </div>
                  <div className="mb-3 inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
                    {w.step <= 1 ? 'Dashboard' : w.step <= 2 ? 'Analysis' : w.step <= 4 ? 'Execution' : 'Social Radar'}
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-white">{w.title}</h3>
                  <p className="text-zinc-400 text-sm">{w.description}</p>
                </Card>
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.02] to-transparent p-[1px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,106,54,0.18),transparent_45%)]" />
                  <div className="relative rounded-2xl border border-white/5 bg-[#0a0a0a] p-3 md:p-4">
                    <WorkflowStepPreview step={w.step} lang={language} onOpen={setLightboxImage} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-16">{copy.pricing.title}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {copy.pricing.plans.map((plan, i) => (
            <Card key={plan.name} className={i === 1 ? 'border-[#F26A36] shadow-lg shadow-[#F26A36]/10' : ''}>
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold mb-6">{plan.price}</div>
              <ul className="space-y-4 mb-8 text-left">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-zinc-400">
                    <CheckCircle className="w-4 h-4 text-green-500" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant={i === 1 ? 'primary' : 'secondary'} className="w-full" onClick={() => setIsDemoModalOpen(true)}>
                {copy.pricing.choosePrefix} {plan.name}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-32 px-4 text-center bg-[#F26A36]/10 border-t border-[#F26A36]/20">
        <h2 className="text-4xl font-bold mb-6">{copy.finalCta.title}</h2>
        <p className="text-zinc-400 mb-8 max-w-2xl mx-auto">{copy.finalCta.subtitle}</p>
        <a
          href="/sign-up"
          className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors bg-[#F26A36] text-white hover:bg-[#F26A36]/90 shadow-xl shadow-[#F26A36]/20 h-14 px-10 text-lg"
        >
          {copy.finalCta.button} <ArrowRight className="ml-2 w-5 h-5" />
        </a>
      </section>

      <footer className="py-8 text-center text-zinc-500 text-sm border-t border-zinc-800">
        <p className="flex items-center justify-center gap-1">{copy.footer.builtWith}</p>
        <p className="mt-2">
          {copy.footer.supportLabel}:{' '}
          <a
            href="mailto:support@restaurantiq.ai"
            className="text-zinc-300 hover:text-white underline underline-offset-2"
          >
            support@restaurantiq.ai
          </a>
        </p>
        <p className="mt-2">&copy; {new Date().getFullYear()} Restaurant IQ.</p>
      </footer>
    </main>
  );
}