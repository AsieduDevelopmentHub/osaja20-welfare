"use client";

import { DashboardPageSkeleton, StatCard } from "@osaja/ui";
import { formatCurrency } from "@osaja/utils";
import { Bell, Cake, ChevronRight, Receipt, Vote, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DuesStatusBanner } from "@/components/DuesStatusBanner";
import { NotificationTypeBadge } from "@/components/NotificationTypeBadge";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { mapContribution, mapDuesSummary, type NotificationItem } from "@/lib/types";
import type { Contribution, DuesSummary } from "@osaja/types";

export default function DashboardPage() {
  const { member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dues, setDues] = useState<DuesSummary | null>(null);
  const [unread, setUnread] = useState(0);
  const [birthdays, setBirthdays] = useState(0);
  const [activeVotes, setActiveVotes] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [recentPayments, setRecentPayments] = useState<Contribution[]>([]);

  useEffect(() => {
    if (!member) return;

    setLoading(true);
    const month = new Date().getMonth() + 1;

    Promise.all([
      apiFetch<Record<string, unknown>>("/members/me/dues"),
      apiFetch<{ count: number }>("/notifications/unread-count"),
      apiFetch<NotificationItem[]>("/notifications?unread_only=false"),
      apiFetch<{ day: number }[]>(`/dashboard/birthdays?month=${month}`),
      apiFetch<Record<string, unknown>[]>("/voting"),
      apiFetch<{ items: Record<string, unknown>[] }>("/members/me/contributions?page=1&page_size=3"),
    ])
      .then(([duesRes, unreadRes, notifRes, birthdaysRes, votesRes, contribRes]) => {
        setDues(mapDuesSummary(duesRes.data as Record<string, unknown>));
        setUnread(unreadRes.data?.count ?? 0);
        setNotifications((notifRes.data as NotificationItem[])?.slice(0, 4) ?? []);
        setBirthdays(Array.isArray(birthdaysRes.data) ? birthdaysRes.data.length : 0);
        setActiveVotes(Array.isArray(votesRes.data) ? votesRes.data.length : 0);
        const items = (contribRes.data?.items ?? []) as Record<string, unknown>[];
        setRecentPayments(items.map(mapContribution));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [member]);

  if (loading) {
    return <DashboardPageSkeleton variant="light" />;
  }

  const duesLabel =
    dues?.currentStatus === "paid"
      ? "Paid ✓"
      : dues?.currentStatus === "overdue"
        ? `${dues.arrearsCount} overdue`
        : "Due now";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${member?.fullName?.split(" ")[0] ?? "Member"}`}
        description="Your welfare dashboard — dues, alerts, and community updates."
      />

      {dues ? <DuesStatusBanner dues={dues} compact /> : null}

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Fund balance"
          value={formatCurrency(dues?.balance ?? 0)}
          icon={Wallet}
          iconClassName="text-emerald-600"
        />
        <StatCard label="This month's dues" value={duesLabel} icon={Receipt} iconClassName="text-brand-gold-dark" />
        <StatCard label="Unread alerts" value={String(unread)} icon={Bell} iconClassName="text-brand-blue" />
        <StatCard label="Active votes" value={String(activeVotes)} icon={Vote} iconClassName="text-brand-navy-light" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent notifications</h3>
            <Link href="/notifications" className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline">
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-brand-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1">
                      <NotificationTypeBadge type={n.type} />
                    </div>
                    <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Recent payments</h3>
            <Link href="/contributions" className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline">
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No payments recorded yet. Pay GHS 30 monthly dues via MoMo — see Contributions for details.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentPayments.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium capitalize text-slate-800">{c.type}</p>
                    <p className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString("en-GH")}</p>
                  </div>
                  <p className="font-bold tabular-nums text-emerald-700">+{formatCurrency(c.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {birthdays > 0 ? (
        <Link
          href="/birthdays"
          className="glass-card flex items-center gap-4 p-4 transition hover:shadow-lg sm:p-5"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
            <Cake className="h-6 w-6 text-amber-600" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">{birthdays} birthday{birthdays === 1 ? "" : "s"} this month</p>
            <p className="text-sm text-slate-500">Celebrate with the OSAJA&apos;20 family</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </Link>
      ) : null}
    </div>
  );
}
