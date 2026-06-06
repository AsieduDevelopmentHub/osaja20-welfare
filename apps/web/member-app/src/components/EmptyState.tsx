import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navy/5 ring-1 ring-brand-navy/10">
        <Icon className="h-7 w-7 text-brand-navy/40" strokeWidth={1.25} />
      </div>
      <div>
        <p className="font-medium text-slate-700">{title}</p>
        {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      </div>
    </div>
  );
}
