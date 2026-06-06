"use client";

import { StatCard } from "@osaja/ui";
import { formatCurrency } from "@osaja/utils";
import { Bell, Cake, Vote, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

export default function DashboardPage() {
  const { member } = useAuth();
  const [balance, setBalance] = useState(0);
  const [unread, setUnread] = useState(0);
  const [birthdays, setBirthdays] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!member) return;
    apiFetch<{ balance: number }>(`/members/${member.id}/balance`)
      .then((r) => setBalance(r.data?.balance ?? 0))
      .catch(() => {});
    apiFetch<{ count: number }>("/notifications/unread-count")
      .then((r) => setUnread(r.data?.count ?? 0))
      .catch(() => {});
    apiFetch<NotificationItem[]>("/notifications?unread_only=false")
      .then((r) => setNotifications((r.data as NotificationItem[])?.slice(0, 4) ?? []))
      .catch(() => {});
    const month = new Date().getMonth() + 1;
    apiFetch<{ day: number }[]>(`/dashboard/birthdays?month=${month}`)
      .then((r) => setBirthdays(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {});
  }, [member]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${member?.fullName?.split(" ")[0] ?? "Member"}`}
        description="Here's what's happening in your welfare community."
      />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Contributions" value={formatCurrency(balance)} icon={Wallet} iconClassName="text-emerald-600" />
        <StatCard label="Unread alerts" value={String(unread)} icon={Bell} iconClassName="text-brand-blue" />
        <StatCard label="Active votes" value="—" icon={Vote} iconClassName="text-brand-navy-light" />
        <StatCard label="Birthdays" value={String(birthdays)} icon={Cake} iconClassName="text-brand-gold-dark" />
      </div>

      <section className="glass-card p-4 sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Recent Notifications</h3>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications yet.</p>
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-brand-500"}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
