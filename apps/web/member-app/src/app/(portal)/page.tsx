"use client";

import { DashboardPageSkeleton, StatCard } from "@osaja/ui";
import { formatCurrency, formatDate } from "@osaja/utils";
import { Bell, Cake, ChevronRight, HeartHandshake, Receipt, Vote, Wallet } from "lucide-react";
import Link from "next/link";
import { DuesStatusBanner } from "@/components/DuesStatusBanner";
import { EmptyState } from "@/components/EmptyState";
import { NotificationTypeBadge } from "@/components/NotificationTypeBadge";
import { PageHeader } from "@/components/PageHeader";
import { VoteResultsCard } from "@/components/VoteResultsCard";
import { Alert } from "@/components/ui";
import { useMemberDashboard } from "@/hooks/useMemberDashboard";
import { useAuth } from "@/lib/auth";
import type { WelfareStatus } from "@osaja/types";

const WELFARE_LABELS: Record<WelfareStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  allocated: "Support allocated",
  resolved: "Resolved",
  archived: "Archived",
};

export default function DashboardPage() {
  const { member } = useAuth();
  const compact = member?.preferences?.compactDashboard ?? false;
  const { data, isLoading, isFetching, error, refetch } = useMemberDashboard(Boolean(member), compact);

  if (isLoading && !data) {
    return <DashboardPageSkeleton variant="light" />;
  }

  const dues = data?.dues ?? null;
  const unread = data?.unread ?? 0;
  const notifications = data?.notifications ?? [];
  const birthdays = data?.birthdays ?? 0;
  const activeVotes = data?.activeVotes ?? 0;
  const recentPayments = data?.recentPayments ?? [];
  const welfareCases = data?.welfareCases ?? [];
  const voteResults = data?.voteResults ?? [];

  const duesLabel =
    dues?.currentStatus === "paid"
      ? "Paid ✓"
      : dues?.currentStatus === "overdue"
        ? `${dues.arrearsCount} overdue`
        : "Due now";

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <PageHeader
        title={`Welcome, ${member?.fullName?.split(" ")[0] ?? "Member"}`}
        description={
          compact
            ? "Quick overview"
            : "Your welfare dashboard — dues, alerts, and community updates."
        }
      />

      {error ? (
        <Alert tone="error">
          {error instanceof Error ? error.message : "Failed to load dashboard"}{" "}
          <button type="button" onClick={() => refetch()} className="font-semibold underline">
            Retry
          </button>
        </Alert>
      ) : null}

      {dues ? <DuesStatusBanner dues={dues} compact /> : null}

      <div
        className={`transition-opacity ${isFetching && data ? "opacity-90" : ""} ${
          compact
            ? "grid grid-cols-2 gap-2"
            : "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4"
        }`}
      >
        <StatCard
          label="Total contributions"
          value={formatCurrency(dues?.balance ?? 0)}
          icon={Wallet}
          iconClassName="text-emerald-600"
        />
        <StatCard label="This month's dues" value={duesLabel} icon={Receipt} iconClassName="text-brand-gold-dark" />
        {!compact ? (
          <>
            <StatCard label="Unread alerts" value={String(unread)} icon={Bell} iconClassName="text-brand-blue" />
            <StatCard label="Active votes" value={String(activeVotes)} icon={Vote} iconClassName="text-brand-navy-light" />
          </>
        ) : (
          <StatCard
            label="Alerts & votes"
            value={`${unread} / ${activeVotes}`}
            icon={Bell}
            iconClassName="text-brand-blue"
          />
        )}
      </div>

      <div className={compact ? "grid gap-5" : "grid gap-8 lg:grid-cols-2"}>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title">Recent notifications</h3>
            <Link href="/notifications" className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline">
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" />
          ) : (
            <ul className="divide-y divide-slate-200/70">
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-brand-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1">
                      <NotificationTypeBadge type={n.type} />
                    </div>
                    <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                    {!compact ? <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!compact ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title">Recent payments</h3>
              <Link href="/contributions" className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline">
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            {recentPayments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No payments yet"
                description="Pay your monthly dues on the Contributions page."
                action={
                  <Link href="/contributions" className="btn-primary text-xs">
                    Go to contributions
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-200/70">
                {recentPayments.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
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
        ) : null}
      </div>

      {welfareCases.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title">Welfare cases</h3>
            <Link href="/welfare" className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline">
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-200/70">
            {welfareCases.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{c.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(c.updatedAt)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {WELFARE_LABELS[c.status] ?? c.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : !compact ? (
        <Link href="/welfare" className="glass-card flex items-center gap-4 p-4 transition hover:shadow-lg sm:p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy/10">
            <HeartHandshake className="h-6 w-6 text-brand-navy" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Welfare support</p>
            <p className="text-sm text-slate-500">Submit or track a welfare request</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </Link>
      ) : null}

      {voteResults.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Vote results</h3>
            <Link href="/voting" className="text-sm font-medium text-brand-navy hover:underline">
              All votes
            </Link>
          </div>
          {voteResults.map((r) => (
            <VoteResultsCard key={r.vote_id} data={r} compact />
          ))}
        </section>
      ) : null}

      {birthdays > 0 && !compact ? (
        <Link href="/birthdays" className="glass-card flex items-center gap-4 p-4 transition hover:shadow-lg sm:p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
            <Cake className="h-6 w-6 text-amber-600" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">
              {birthdays} birthday{birthdays === 1 ? "" : "s"} this month
            </p>
            <p className="text-sm text-slate-500">Celebrate with the OSAJA&apos;20 family</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </Link>
      ) : null}
    </div>
  );
}
