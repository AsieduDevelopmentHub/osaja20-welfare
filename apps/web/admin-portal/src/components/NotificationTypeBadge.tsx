import type { NotificationType } from "@osaja/types";
import { Bell, Cake, Megaphone, MessageSquare, Receipt, Users, Vote, Wallet } from "lucide-react";

const TYPE_CONFIG: Record<
  NotificationType | string,
  { label: string; className: string; icon: typeof Bell }
> = {
  contribution: { label: "Contribution", className: "bg-emerald-500/20 text-emerald-300", icon: Receipt },
  payment: { label: "Payment", className: "bg-teal-500/20 text-teal-300", icon: Wallet },
  support: { label: "Support", className: "bg-indigo-500/20 text-indigo-300", icon: MessageSquare },
  celebration: { label: "Birthday", className: "bg-amber-500/20 text-amber-300", icon: Cake },
  announcement: { label: "Announcement", className: "bg-blue-500/20 text-blue-300", icon: Megaphone },
  voting: { label: "Voting", className: "bg-violet-500/20 text-violet-300", icon: Vote },
  welfare: { label: "Welfare", className: "bg-rose-500/20 text-rose-300", icon: Users },
  meeting: { label: "Meeting", className: "bg-slate-500/20 text-slate-300", icon: Bell },
};

export function NotificationTypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] ?? { label: type, className: "bg-slate-500/20 text-slate-300", icon: Bell };
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {config.label}
    </span>
  );
}
