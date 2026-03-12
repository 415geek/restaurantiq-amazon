import { Badge } from '@/components/ui/Badge';

export function PageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
          {badge ? <Badge className="border-orange-500/30 bg-orange-500/10 text-orange-300">{badge}</Badge> : null}
        </div>
        {description ? <p className="text-sm text-zinc-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
    </div>
  );
}
