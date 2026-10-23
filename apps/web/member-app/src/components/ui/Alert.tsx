"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type AlertTone = "success" | "error" | "info" | "warning";

const TONES: Record<
  AlertTone,
  { wrap: string; icon: typeof Info; role: "status" | "alert" }
> = {
  success: {
    wrap: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: CheckCircle2,
    role: "status",
  },
  error: {
    wrap: "bg-red-50 text-red-700 ring-red-200",
    icon: AlertCircle,
    role: "alert",
  },
  info: {
    wrap: "bg-sky-50 text-sky-800 ring-sky-200",
    icon: Info,
    role: "status",
  },
  warning: {
    wrap: "bg-amber-50 text-amber-900 ring-amber-200",
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
          className="shrink-0 rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
