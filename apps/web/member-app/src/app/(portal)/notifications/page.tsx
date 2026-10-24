"use client";

import { NotificationListSkeleton } from "@osaja/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { NotificationTypeBadge } from "@/components/NotificationTypeBadge";
import { PageHeader } from "@/components/PageHeader";
import { FilterPills } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NotificationItem } from "@/lib/types";

type NotifFilter = "all" | "unread";

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotifFilter>("all");

  const { data: items = [], isLoading, isFetching } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const res = await apiFetch<NotificationItem[]>("/notifications");
      return (res.data as NotificationItem[]) ?? [];
    },
  });

  const invalidateNotifs = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const prev = queryClient.getQueryData<NotificationItem[]>(queryKeys.notifications);
      queryClient.setQueryData<NotificationItem[]>(queryKeys.notifications, (old = []) =>
        old.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.notifications, ctx.prev);
    },
    onSettled: invalidateNotifs,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiFetch("/notifications/mark-all-read", { method: "POST" }),
    onSuccess: invalidateNotifs,
  });

  const deleteOne = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const prev = queryClient.getQueryData<NotificationItem[]>(queryKeys.notifications);
      queryClient.setQueryData<NotificationItem[]>(queryKeys.notifications, (old = []) =>
        old.filter((n) => n.id !== id)
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.notifications, ctx.prev);
    },
    onSettled: invalidateNotifs,
  });

  const deleteAll = useMutation({
    mutationFn: () => apiFetch("/notifications", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.notifications, []);
      queryClient.setQueryData(queryKeys.unreadCount, 0);
    },
  });

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
          !isLoading && items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="btn-ghost"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => deleteAll.mutate()}
                disabled={deleteAll.isPending}
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

      {isLoading ? (
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
        <div className={`glass-card divide-y divide-slate-100 ${isFetching ? "opacity-90" : ""}`}>
          {visible.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-2 px-4 py-4 sm:px-6 ${!n.read ? "bg-brand-50/30" : ""}`}
            >
              <button
                type="button"
                onClick={() => !n.read && markRead.mutate(n.id)}
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
                onClick={() => deleteOne.mutate(n.id)}
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
