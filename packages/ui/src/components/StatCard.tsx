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
          ? "rounded-2xl border border-slate-700/50 bg-slate-850/80 p-4 shadow-glass backdrop-blur-sm sm:p-6"
          : "rounded-2xl border border-white/40 bg-white/70 p-4 shadow-glass backdrop-blur-md sm:p-6"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isDark ? "bg-brand-600/20" : "bg-brand-50"
          }`}
        >
          <Icon className={`h-5 w-5 ${iconClassName}`} strokeWidth={1.75} />
        </div>
        <p className={`text-xl font-bold sm:text-2xl ${isDark ? "text-white" : "text-slate-900"}`}>
          {value}
        </p>
      </div>
      <p className={`mt-3 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
    </div>
  );
}
