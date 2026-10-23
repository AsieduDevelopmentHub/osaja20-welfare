import type { LucideIcon } from "lucide-react";

export function AdminHeader({
  title,
  description,
  action,
  icon: Icon,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 ring-1 ring-brand-gold/25">
            <Icon className="h-5 w-5 text-brand-gold" strokeWidth={1.75} />
          </div>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{eyebrow}</p>
          ) : null}
          <h1 className={`text-2xl font-bold text-white ${eyebrow ? "mt-0.5" : ""}`}>{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
