import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName?: string;
  variant?: "light" | "dark";
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName = "text-brand-600",
  variant = "light",
}: StatCardProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={
        isDark
          ? "flex min-h-[7.25rem] flex-col rounded-2xl border border-slate-700/50 bg-slate-850/80 p-4 shadow-glass backdrop-blur-sm sm:min-h-[7.75rem] sm:p-5"
          : "flex min-h-[7.25rem] flex-col rounded-2xl border border-white/40 bg-white/80 p-4 shadow-glass backdrop-blur-md sm:min-h-[7.75rem] sm:p-5"
      }
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p
          className={`min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide leading-snug ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {label}
        </p>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${
            isDark ? "bg-brand-gold/20" : "bg-brand-navy/8"
          }`}
        >
          <Icon
            className={`h-4 w-4 sm:h-5 sm:w-5 ${iconClassName || (isDark ? "text-brand-gold" : "text-brand-navy")}`}
            strokeWidth={1.75}
          />
        </div>
      </div>
      <p
        className={`mt-auto break-words text-lg font-bold tabular-nums leading-tight sm:text-2xl ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
