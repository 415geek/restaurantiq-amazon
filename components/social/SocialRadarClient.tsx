'use client';

import { useEffect, useState } from 'react';
import { Bot, ExternalLink, MessageSquareReply, RefreshCw, RotateCcw, Send, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { socialLatestCommentsMock, socialMentionsMock, socialPlatformMetricsMock } from '@/lib/mock-data';
import type { SocialCommentItem, SocialMentionPost, SocialPlatformMetric } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

type ReplyState = {
  draft: string;
  aiGenerated: boolean;
  sending: boolean;
  sent: boolean;
  rollbackUntil?: number;
  sentText?: string;
};

const platformColors: Record<string, string> = {
  facebook: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  instagram: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
  tiktok: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  yelp: 'border-red-500/30 bg-red-500/10 text-red-300',
  google: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  xiaohongshu: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
};

function formatCount(value?: number) {
  if (value == null) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function SocialRadarClient() {
  const toast = useToast();
  const { lang } = useDashboardLanguage();
  const [metrics, setMetrics] = useState<SocialPlatformMetric[]>(socialPlatformMetricsMock);
  const [comments, setComments] = useState(socialLatestCommentsMock);
  const [mentions, setMentions] = useState<SocialMentionPost[]>(socialMentionsMock);
  const [replies, setReplies] = useState<Record<string, ReplyState>>({});
  const [busyAiId, setBusyAiId] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [metaWarning, setMetaWarning] = useState<string | null>(null);
  const [metaConnected, setMetaConnected] = useState<{ facebook: boolean; instagram: boolean }>({ facebook: false, instagram: false });

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const text = lang === 'zh'
    ? {
        title: 'Social Media Radar',
        desc: '统一查看社媒平台评分、评论量、点赞/收藏/转发趋势，并在最新评论上进行 AI 自动回复或手动回复。',
        badge: 'Social Ops',
        refresh: '刷新数据',
        metrics: '平台数据面板',
        latestComments: '最新评论与回复',
        mentions: '外部博主提及博文',
        aiReply: 'AI 自动回复',
        send: '发送',
        rollback: '回撤',
        manualPlaceholder: '输入你的回复内容…',
        directSend: '直接发送',
        sent: '已发送',
        aiDraftReady: 'AI 回复草稿已生成，可编辑后发送。',
        sentToast: '回复已发送',
        rollbackToast: '回复已回撤',
        generating: '生成中…',
        noDraft: '请先输入回复内容或使用 AI 自动回复',
        latestMentionCTA: '查看原帖',
        minuteRollback: 'AI 回复发送后可在 1 分钟内回撤',
        rating: '评分', reviews: '评论数', likes: '点赞', saves: '收藏', shares: '转发', mentionsMetric: '提及', followersDelta: '粉丝变化',
        metaConnections: 'Meta 连接状态',
        connected: '已连接',
        notConnected: '未连接',
      }
    : {
        title: 'Social Media Radar',
        desc: 'Monitor ratings, review volume, likes/saves/shares, reply to fresh comments with AI or manually, and track external creator mentions in one place.',
        badge: 'Social Ops',
        refresh: 'Refresh',
        metrics: 'Platform Metrics',
        latestComments: 'Latest Comments & Reply Console',
        mentions: 'Creator Mentions Feed',
        aiReply: 'AI Reply',
        send: 'Send',
        rollback: 'Rollback',
        manualPlaceholder: 'Write a reply…',
        directSend: 'Send now',
        sent: 'Sent',
        aiDraftReady: 'AI draft generated. Edit before sending if needed.',
        sentToast: 'Reply sent',
        rollbackToast: 'Reply rolled back',
        generating: 'Generating…',
        noDraft: 'Write a reply or generate an AI draft first',
        latestMentionCTA: 'Open Post',
        minuteRollback: 'AI-generated replies can be rolled back within 1 minute after send',
        rating: 'Rating', reviews: 'Reviews', likes: 'Likes', saves: 'Saves', shares: 'Shares', mentionsMetric: 'Mentions', followersDelta: 'Follower Δ',
        metaConnections: 'Meta Connection Status',
        connected: 'Connected',
        notConnected: 'Not connected',
      };

  const loadMetaSocial = async () => {
    try {
      const res = await fetch('/api/social/meta', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch meta social data');
      const data = await res.json();
      if (Array.isArray(data.metrics)) setMetrics(data.metrics);
      if (Array.isArray(data.comments)) setComments(data.comments);
      if (Array.isArray(data.mentions)) setMentions(data.mentions);
      if (data.connected) setMetaConnected({ facebook: Boolean(data.connected.facebook), instagram: Boolean(data.connected.instagram) });
      setMetaWarning(typeof data.warning === 'string' ? data.warning : null);
    } catch {
      setMetaWarning(lang === 'zh' ? '社媒数据接口加载失败，已使用本地 mock 数据。' : 'Social API load failed. Using local mock data.');
      setMetrics(socialPlatformMetricsMock);
      setComments(socialLatestCommentsMock);
      setMentions(socialMentionsMock);
    }
  };

  useEffect(() => {
    loadMetaSocial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAiReply = async (comment: SocialCommentItem) => {
    setBusyAiId(comment.id);
    try {
      const res = await fetch('/api/social/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id, commentText: comment.text, platform: comment.platform, language: lang }),
      });
      const data = await res.json();
      const replyText = data.reply ?? '';
      setReplies((prev) => ({
        ...prev,
        [comment.id]: { ...(prev[comment.id] ?? { draft: '', aiGenerated: false, sending: false, sent: false }), draft: replyText, aiGenerated: true, sending: false, sent: false },
      }));
      toast.success(text.aiDraftReady);
    } catch {
      toast.error('AI reply generation failed');
    } finally {
      setBusyAiId(null);
    }
  };

  const sendReply = async (comment: SocialCommentItem) => {
    const state = replies[comment.id];
    const draft = state?.draft?.trim();
    if (!draft) return toast.error(text.noDraft);
    setReplies((prev) => ({ ...prev, [comment.id]: { ...(prev[comment.id] ?? { draft: '', aiGenerated: false, sent: false }), draft, sending: true, aiGenerated: Boolean(prev[comment.id]?.aiGenerated), sent: false } as ReplyState }));
    try {
      const res = await fetch('/api/social/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id, replyText: draft, platform: comment.platform, aiGenerated: Boolean(state?.aiGenerated) }),
      });
      const data = await res.json();
      setReplies((prev) => ({
        ...prev,
        [comment.id]: {
          ...(prev[comment.id] ?? { draft, aiGenerated: false }),
          draft,
          sending: false,
          sent: true,
          sentText: draft,
          rollbackUntil: data.rollback_deadline ? new Date(data.rollback_deadline).getTime() : undefined,
        },
      }));
      setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, status: 'replied' } : c)));
      toast.success(text.sentToast);
    } catch {
      setReplies((prev) => ({ ...prev, [comment.id]: { ...(prev[comment.id] ?? { draft: '', aiGenerated: false }), sending: false, sent: false, draft } as ReplyState }));
      toast.error('Send failed');
    }
  };

  const rollbackReply = async (comment: SocialCommentItem) => {
    const state = replies[comment.id];
    if (!state?.rollbackUntil || state.rollbackUntil < Date.now()) return;
    await fetch('/api/social/reply', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId: comment.id }) });
    setReplies((prev) => ({ ...prev, [comment.id]: { ...(prev[comment.id] as ReplyState), sent: false, rollbackUntil: undefined } }));
    setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, status: 'new' } : c)));
    toast.warning(text.rollbackToast);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={text.title}
        description={text.desc}
        badge={text.badge}
        actions={<Button variant="secondary" onClick={async () => { await loadMetaSocial(); toast.success(lang === 'zh' ? '社媒数据已刷新（mock/live 混合）' : 'Social metrics refreshed (mock/live mix)'); }}><RefreshCw className="h-4 w-4" /> {text.refresh}</Button>}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <span className="text-sm text-zinc-300">{text.metaConnections}</span>
          <Badge className={metaConnected.facebook ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-800/40 text-zinc-300'}>
            Facebook: {metaConnected.facebook ? text.connected : text.notConnected}
          </Badge>
          <Badge className={metaConnected.instagram ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-800/40 text-zinc-300'}>
            Instagram: {metaConnected.instagram ? text.connected : text.notConnected}
          </Badge>
          {metaWarning ? <span className="text-xs text-zinc-500">{metaWarning}</span> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{text.metrics}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {metrics.map((m) => (
            <div key={m.platform} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge className={platformColors[m.platform]}>{m.label}</Badge>
                {m.rating ? <span className="text-sm font-semibold text-zinc-100">⭐ {m.rating.toFixed(1)}</span> : null}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Metric label={text.reviews} value={formatCount(m.reviews_count)} />
                <Metric label={text.likes} value={formatCount(m.likes)} />
                <Metric label={text.saves} value={formatCount(m.saves)} />
                <Metric label={text.shares} value={formatCount(m.shares)} />
                <Metric label={text.mentionsMetric} value={formatCount(m.mentions)} />
                <Metric label={text.followersDelta} value={`${m.followers_delta_pct && m.followers_delta_pct > 0 ? '+' : ''}${m.followers_delta_pct ?? 0}%`} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="text-base">{text.latestComments}</CardTitle>
            <p className="text-xs text-zinc-500">{text.minuteRollback}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.map((comment) => {
              const state = replies[comment.id] ?? { draft: '', aiGenerated: false, sending: false, sent: false };
              const rollbackRemaining = state.rollbackUntil ? Math.max(0, state.rollbackUntil - tick) : 0;
              return (
                <div key={comment.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={platformColors[comment.platform]}>{comment.platform}</Badge>
                      <span className="text-sm font-medium text-zinc-100">{comment.author}</span>
                      {comment.rating ? <span className="text-xs text-zinc-400">⭐ {comment.rating}</span> : null}
                    </div>
                    <div className="text-xs text-zinc-500">{new Date(comment.created_at).toLocaleString()}</div>
                  </div>
                  <p className="text-sm text-zinc-300">{comment.text}</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Badge>{comment.sentiment}</Badge>
                    <span>{comment.likes ?? 0} likes</span>
                    <span>{state.sent ? text.sent : comment.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" disabled={busyAiId === comment.id || state.sending} onClick={() => requestAiReply(comment)}>
                      <Bot className="h-4 w-4" /> {busyAiId === comment.id ? text.generating : text.aiReply}
                    </Button>
                    <Button size="sm" onClick={() => sendReply(comment)} disabled={state.sending}>
                      <Send className="h-4 w-4" /> {text.directSend}
                    </Button>
                    {state.sent && state.aiGenerated && rollbackRemaining > 0 ? (
                      <Button variant="danger" size="sm" onClick={() => rollbackReply(comment)}>
                        <RotateCcw className="h-4 w-4" /> {text.rollback} {Math.floor(rollbackRemaining / 1000)}s
                      </Button>
                    ) : null}
                  </div>
                  <textarea
                    value={state.draft}
                    onChange={(e) => setReplies((prev) => ({ ...prev, [comment.id]: { ...state, draft: e.target.value, aiGenerated: state.aiGenerated, sent: false } }))}
                    placeholder={text.manualPlaceholder}
                    className="min-h-20 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F26A36]/60"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{text.mentions}</CardTitle>
            <Badge className="border-orange-500/30 bg-orange-500/10 text-orange-300"><Sparkles className="mr-1 h-3 w-3" /> {mentions.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {mentions.map((post) => (
              <a key={post.id} href={post.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/60">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge className={platformColors[post.platform]}>{post.platform}</Badge>
                    <span className="text-xs text-zinc-400">{post.author}</span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-500" />
                </div>
                <p className="text-sm font-medium text-zinc-100">{post.title}</p>
                <p className="mt-1 text-xs text-zinc-400">{post.excerpt}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                  <span>❤️ {formatCount(post.likes)}</span>
                  <span>🔖 {formatCount(post.saves)}</span>
                  <span>🔁 {formatCount(post.shares)}</span>
                  <span>{new Date(post.posted_at).toLocaleString()}</span>
                </div>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-2">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
