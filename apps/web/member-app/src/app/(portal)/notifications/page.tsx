"use client";

import { NotificationListSkeleton } from "@osaja/ui";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NotificationTypeBadge } from "@/components/NotificationTypeBadge";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<NotificationItem[]>("/notifications");
      setItems((res.data as NotificationItem[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await apiFetch("/notifications/mark-all-read", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Notifications" description="Meetings, welfare updates, and announcements." />
        {!loading && items.some((n) => !n.read) ? (
          <button
            type="button"
            onClick={markAllRead}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        ) : null}
      </div>

      {loading ? (
        <NotificationListSkeleton variant="light" />
      ) : (
        <div className="glass-card divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-slate-400">
              <Bell className="h-10 w-10" strokeWidth={1.25} />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.read && markRead(n.id)}
                className={`w-full px-4 py-4 text-left transition hover:bg-slate-50/80 sm:px-6 ${!n.read ? "bg-brand-50/30" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-brand-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5">
                      <NotificationTypeBadge type={n.type} />
                    </div>
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
