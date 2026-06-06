import type { DuesPeriod } from "@osaja/types";
import { Check, Clock, Minus, X } from "lucide-react";

const STATUS_STYLES = {
  paid: {
    bg: "bg-emerald-50 ring-emerald-200 text-emerald-700",
    icon: Check,
    dot: "bg-emerald-500",
  },
  due: {
    bg: "bg-amber-50 ring-amber-200 text-amber-800",
    icon: Clock,
    dot: "bg-amber-500",
  },
  overdue: {
    bg: "bg-red-50 ring-red-200 text-red-700",
    icon: X,
    dot: "bg-red-500",
  },
  upcoming: {
    bg: "bg-slate-50 ring-slate-200 text-slate-400",
    icon: Minus,
    dot: "bg-slate-300",
  },
} as const;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthDuesGrid({ periods }: { periods: DuesPeriod[] }) {
  const recent = [...periods].reverse().slice(0, 12).reverse();

  return (
    <div className="glass-card p-4 sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Payment calendar</h3>
      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-6">
        {recent.map((p) => {
          const style = STATUS_STYLES[p.status];
          const Icon = style.icon;
          return (
            <div
              key={`${p.year}-${p.month}`}
              title={`${p.label} — ${p.status}`}
              className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 ring-1 ${style.bg}`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {MONTH_SHORT[p.month - 1]}
              </span>
              <span className="text-[10px] tabular-nums opacity-60">{String(p.year).slice(2)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        {(Object.entries(STATUS_STYLES) as [keyof typeof STATUS_STYLES, typeof STATUS_STYLES.paid][]).map(
          ([key, s]) => (
            <span key={key} className="flex items-center gap-1.5 capitalize">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              {key}
            </span>
          )
        )}
      </div>
    </div>
  );
}
