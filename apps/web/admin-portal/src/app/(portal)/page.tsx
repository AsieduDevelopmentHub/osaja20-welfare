"use client";

import { adminModules, DashboardPageSkeleton, Skeleton, StatCard } from "@osaja/ui";
import { formatCurrency } from "@osaja/utils";
import { Cake, Download, Megaphone, Users, Vote, Wallet } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useAuth } from "@/lib/auth";

export default function AdminDashboard() {
  const { member } = useAuth();
  const { data, isLoading, isFetching, error, refetch } = useAdminDashboard(Boolean(member));

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton variant="dark" className="h-4 w-28" />
            <Skeleton variant="dark" className="h-8 w-56 sm:h-9" />
            <Skeleton variant="dark" className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton variant="dark" className="h-10 w-24 rounded-xl" />
            <Skeleton variant="dark" className="h-10 w-28 rounded-xl" />
          </div>
        </header>
        <DashboardPageSkeleton variant="dark" />
      </div>
    );
  }

  const stats = data?.stats ?? {
    total_members: 0,
    active_members: 0,
    pending_welfare_cases: 0,
    total_contributions: 0,
    upcoming_birthdays_today: 0,
    active_votes: 0,
  };
  const recentMembers = data?.recentMembers ?? [];

  const statCards = [
    { label: "Total members", value: String(stats.total_members), icon: Users },
    { label: "Active members", value: String(stats.active_members), icon: Users, iconClassName: "text-brand-gold" },
    { label: "Pending welfare", value: String(stats.pending_welfare_cases), icon: Wallet },
    {
      label: "Contributions",
      value: formatCurrency(stats.total_contributions),
      icon: Wallet,
      iconClassName: "text-green-400",
    },
    { label: "Active votes", value: String(stats.active_votes), icon: Vote, iconClassName: "text-sky-300" },
    { label: "Birthdays today", value: String(stats.upcoming_birthdays_today), icon: Cake, iconClassName: "text-amber-400" },
  ];

  return (
    <div className={`space-y-6 ${isFetching && data ? "opacity-95" : ""}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-gold">Administration</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">OSAJA&apos;20 Welfare</h1>
          <p className="text-sm text-slate-400">Leadership analytics & operations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/reports" className="btn-ghost">
            <Download className="h-4 w-4" />
            Export
          </Link>
          <Link href="/announcements" className="btn-gold">
            <Megaphone className="h-4 w-4" />
            Announce
          </Link>
        </div>
      </header>

      {error ? (
        <Alert tone="error">
          {error instanceof Error ? error.message : "Failed to load dashboard"}{" "}
          <button type="button" onClick={() => refetch()} className="font-semibold underline">
            Retry
          </button>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} variant="dark" />
        ))}
      </div>

      <section className="admin-panel p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Recent members</h2>
          <Link href="/members" className="text-sm font-medium text-brand-gold hover:underline">
            View all
          </Link>
        </div>
        {recentMembers.length === 0 ? (
          <p className="text-sm text-slate-400">No members registered yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {recentMembers.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{m.fullName}</p>
                  <p className="truncate text-xs text-slate-400">{m.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 capitalize text-slate-300">{m.status}</span>
                  <span className="truncate text-xs text-slate-400">
                    @{m.username} · {m.membershipId}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-panel p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Management modules</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.name}
                href={mod.href}
                className="flex gap-4 rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 transition hover:border-brand-600/40 hover:bg-slate-800/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20">
                  <Icon className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{mod.name}</h3>
                  <p className="mt-0.5 text-sm text-slate-400">{mod.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
