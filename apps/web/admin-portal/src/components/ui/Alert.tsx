"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type AlertTone = "success" | "error" | "info" | "warning";

const TONES: Record<
  AlertTone,
  { wrap: string; icon: typeof Info; role: "status" | "alert" }
> = {
  success: {
    wrap: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    icon: CheckCircle2,
    role: "status",
  },
  error: {
    wrap: "bg-red-500/10 text-red-300 ring-red-500/20",
    icon: AlertCircle,
    role: "alert",
  },
  info: {
    wrap: "bg-sky-500/10 text-sky-200 ring-sky-500/20",
    icon: Info,
    role: "status",
  },
  warning: {
    wrap: "bg-amber-500/10 text-amber-200 ring-amber-500/20",
    icon: AlertCircle,
    role: "alert",
  },
};

export function Alert({
  tone = "info",
  children,
  onDismiss,
}: {
  tone?: AlertTone;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const config = TONES[tone];
  const Icon = config.icon;

  return (
    <div
      role={config.role}
      className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${config.wrap}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 opacity-70 transition hover:bg-white/10 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
