import type { ReactNode } from "react";
import Link from "next/link";

interface SmsPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SmsPageHeader({
  eyebrow = "SMS Portal",
  title,
  description,
  action,
}: SmsPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-brand-gold">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}

interface SmsEmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function SmsEmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: SmsEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-brand-gold" aria-hidden />
      <p className="mt-4 text-sm font-semibold text-white">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{description}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  delivered: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  submitted: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  scheduled: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  upcoming: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  due: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  sending: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  queued: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  draft: "bg-slate-500/20 text-slate-300 ring-slate-500/30",
  failed: "bg-red-500/15 text-red-300 ring-red-500/30",
  invalid: "bg-red-500/15 text-red-300 ring-red-500/30",
  cancelled: "bg-slate-500/20 text-slate-300 ring-slate-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  sent: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  enabled: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  sandbox: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
};

export function SmsStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const style = STATUS_STYLES[key] ?? "bg-white/10 text-slate-300 ring-white/10";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  );
}

interface StepDef {
  id: string;
  label: string;
}

export function SmsStepper({
  steps,
  current,
}: {
  steps: StepDef[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="Progress">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                done
                  ? "bg-brand-gold text-brand-navy-dark"
                  : active
                    ? "bg-brand-gold/20 text-brand-gold ring-2 ring-brand-gold"
                    : "bg-white/10 text-slate-500"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : index + 1}
            </div>
            <span
              className={`hidden truncate text-xs font-medium sm:inline ${
                active ? "text-white" : done ? "text-brand-gold" : "text-slate-500"
              }`}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span
                className={`mx-0.5 h-px flex-1 ${done ? "bg-brand-gold/60" : "bg-white/10"}`}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Mobile phone-frame message preview */
export function SmsPhonePreview({
  message,
  sender = "OSAJA20",
}: {
  message: string;
  sender?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[260px]">
      <div className="rounded-[1.75rem] border border-white/15 bg-slate-950 p-2 shadow-xl shadow-black/40">
        <div className="rounded-[1.35rem] bg-gradient-to-b from-slate-900 to-slate-950 px-3 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-center">
            <span className="h-1 w-12 rounded-full bg-white/20" />
          </div>
          <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Messages
          </p>
          <div className="rounded-2xl rounded-tl-sm bg-brand-navy px-3 py-2.5 shadow-inner">
            <p className="text-[10px] font-semibold text-brand-gold">{sender}</p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug text-slate-100">
              {message.trim() || (
                <span className="italic text-slate-500">Your message preview…</span>
              )}
            </p>
          </div>
          <p className="mt-2 text-center text-[9px] text-slate-600">SMS · now</p>
        </div>
      </div>
    </div>
  );
}

export function SmsAlert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "warning" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "bg-red-500/10 text-red-300 border-red-500/20",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-200 border-amber-500/20",
    info: "bg-sky-500/10 text-sky-200 border-sky-500/20",
  };
  return (
    <p className={`rounded-xl border px-4 py-3 text-sm ${styles[variant]}`} role="status">
      {children}
    </p>
  );
}

/** Sticky mobile action bar above bottom nav */
export function SmsStickyActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 z-20 border-t border-white/10 bg-brand-navy-dark/95 px-4 py-3 backdrop-blur-md lg:static lg:z-auto lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
      style={{ bottom: "calc(3.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-7xl gap-2 lg:justify-end">{children}</div>
    </div>
  );
}
