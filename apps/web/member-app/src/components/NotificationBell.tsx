"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<{ count: number }>("/notifications/unread-count");
      setCount(Number(res.data?.count ?? 0));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const label =
    count > 0
      ? `${count} unread notification${count === 1 ? "" : "s"}`
      : "Notifications";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl text-brand-navy transition hover:bg-brand-navy/5"
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
