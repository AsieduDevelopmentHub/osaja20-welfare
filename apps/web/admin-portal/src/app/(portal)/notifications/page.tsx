"use client";

import { NotificationListSkeleton } from "@osaja/ui";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { NotificationTypeBadge } from "@/components/NotificationTypeBadge";
import { apiFetch } from "@/lib/api";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function AdminNotificationsPage() {
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

  const deleteOne = async (id: string) => {
    await apiFetch(`/notifications/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const deleteAll = async () => {
    await apiFetch("/notifications", { method: "DELETE" });
    setItems([]);
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminHeader
          title="Notifications"
          description={
            unread > 0
              ? `${unread} unread — payments, inquiries, birthdays, and more.`
              : "Payments, member inquiries, birthdays, and announcements."
          }
        />
        {!loading && items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              onClick={deleteAll}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <NotificationListSkeleton variant="dark" />
      ) : (
        <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-brand-navy/60">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-slate-500">
              <Bell className="h-10 w-10" strokeWidth={1.25} />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 px-4 py-4 sm:px-6 ${!n.read ? "bg-white/5" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => !n.read && markRead(n.id)}
                  className="min-w-0 flex-1 text-left transition hover:opacity-90"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-600" : "bg-brand-gold"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5">
                        <NotificationTypeBadge type={n.type} />
                      </div>
                      <p className="font-medium text-white">{n.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{n.message}</p>
                      {n.type === "support" ? (
                        <Link href="/inquiries" className="mt-2 inline-block text-xs font-semibold text-brand-gold hover:underline">
                          Open inquiries →
                        </Link>
                      ) : null}
                      {n.type === "payment" ? (
                        <Link
                          href="/contributions"
                          className="mt-2 inline-block text-xs font-semibold text-brand-gold hover:underline"
                        >
                          View contributions →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteOne(n.id)}
                  aria-label="Delete notification"
                  className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
