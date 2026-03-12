import { Badge } from '@/components/ui/Badge';

export function ImpactScoreBadge({ score }: { score: number }) {
  const tone = score >= 8 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : score >= 5 ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300' : 'border-zinc-700 text-zinc-300';
  return <Badge className={tone}>Impact {score}/10</Badge>;
}
