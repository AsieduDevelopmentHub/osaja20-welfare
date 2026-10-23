"use client";

import { NotificationListSkeleton } from "@osaja/ui";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { NotificationTypeBadge } from "@/components/NotificationTypeBadge";
import { PageHeader } from "@/components/PageHeader";
import { FilterPills } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

type NotifFilter = "all" | "unread";

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotifFilter>("all");

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
  const visible = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read) : items),
    [filter, items]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Bell}
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "Meetings, welfare updates, and announcements."}
        action={
          !loading && items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {unread > 0 ? (
                <button type="button" onClick={markAllRead} className="btn-ghost">
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </button>
              ) : null}
              <button
                type="button"
                onClick={deleteAll}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </button>
            </div>
          ) : undefined
        }
      />

      <FilterPills<NotifFilter>
        options={[
          { value: "all", label: "All" },
          { value: "unread", label: `Unread${unread ? ` (${unread})` : ""}` },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <NotificationListSkeleton variant="light" />
      ) : visible.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={Bell}
            title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
            description={
              filter === "unread" ? "No unread alerts right now." : "Updates from the welfare team will show here."
            }
          />
        </div>
      ) : (
        <div className="glass-card divide-y divide-slate-100">
          {visible.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-2 px-4 py-4 sm:px-6 ${!n.read ? "bg-brand-50/30" : ""}`}
            >
              <button
                type="button"
                onClick={() => !n.read && markRead(n.id)}
                className="min-w-0 flex-1 text-left transition hover:opacity-90"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-brand-500"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5">
                      <NotificationTypeBadge type={n.type} />
                    </div>
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => deleteOne(n.id)}
                aria-label="Delete notification"
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
