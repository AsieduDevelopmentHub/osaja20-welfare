"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useUnreadCount } from "@/hooks/useUnreadCount";

export function NotificationBell() {
  const { data: count = 0 } = useUnreadCount();

  const label =
    count > 0
      ? `${count} unread notification${count === 1 ? "" : "s"}`
      : "Notifications";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl text-white transition hover:bg-white/10"
    >
      <Bell className="h-5 w-5" strokeWidth={1.75} />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
