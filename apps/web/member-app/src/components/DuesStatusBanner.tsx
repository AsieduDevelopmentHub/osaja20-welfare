import type { DuesSummary } from "@osaja/types";
import { formatCurrency } from "@osaja/utils";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

const STATUS_CONFIG = {
  paid: {
    icon: CheckCircle2,
    label: "Paid this month",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    accent: "from-emerald-500/10 to-brand-gold/5",
  },
  due: {
    icon: Clock,
    label: "Due this month",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    accent: "from-amber-500/10 to-brand-gold/5",
  },
  overdue: {
    icon: AlertCircle,
    label: "Overdue",
    badge: "bg-red-50 text-red-700 ring-red-200",
    accent: "from-red-500/10 to-brand-gold/5",
  },
} as const;

export function DuesStatusBanner({ dues, compact = false }: { dues: DuesSummary; compact?: boolean }) {
  const config = STATUS_CONFIG[dues.currentStatus];
  const Icon = config.icon;

  if (compact) {
    return (
      <Link
        href="/contributions"
        className={`glass-card block overflow-hidden bg-gradient-to-br ${config.accent} p-4 transition hover:shadow-lg sm:p-5`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${config.badge}`}>
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly dues</p>
              <p className="truncate font-semibold text-brand-navy">{dues.currentMonth.label}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${config.badge}`}>
            {config.label}
          </span>
        </div>
        {dues.arrearsCount > 0 ? (
          <p className="mt-3 text-sm text-red-600">
            {dues.arrearsCount} month{dues.arrearsCount === 1 ? "" : "s"} in arrears · {formatCurrency(dues.totalOwed)} owed
          </p>
        ) : null}
      </Link>
    );
  }

  return (
    <div className={`glass-card overflow-hidden bg-gradient-to-br ${config.accent}`}>
      <div className="border-b border-white/60 px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${config.badge}`}>
              <Icon className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly welfare dues</p>
              <p className="mt-1 text-2xl font-bold text-brand-navy">{formatCurrency(dues.monthlyAmount)}</p>
              <p className="mt-1 text-sm text-slate-600">{dues.currentMonth.label}</p>
            </div>
          </div>
          <span className={`self-start rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${config.badge}`}>
            {config.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-100/80 sm:grid-cols-4">
        <Stat label="Total contributions" value={formatCurrency(dues.balance)} />
        <Stat label="Months paid" value={String(dues.totalPaidMonths)} />
        <Stat label="Arrears" value={String(dues.arrearsCount)} highlight={dues.arrearsCount > 0} />
        <Stat
          label="Amount owed"
          value={dues.totalOwed > 0 ? formatCurrency(dues.totalOwed) : "—"}
          highlight={dues.totalOwed > 0}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white/90 px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums sm:text-base ${highlight ? "text-red-600" : "text-brand-navy"}`}>
        {value}
      </p>
    </div>
  );
}
