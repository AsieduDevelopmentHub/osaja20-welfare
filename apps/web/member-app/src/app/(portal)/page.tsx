"use client";

import { DashboardPageSkeleton, StatCard } from "@osaja/ui";
import { formatCurrency } from "@osaja/utils";
import { Bell, Cake, ChevronRight, HeartHandshake, Receipt, Vote, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DuesStatusBanner } from "@/components/DuesStatusBanner";
import { NotificationTypeBadge } from "@/components/NotificationTypeBadge";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { VoteResultsCard, type PublishedVoteResult } from "@/components/VoteResultsCard";
import { mapContribution, mapDuesSummary, type NotificationItem } from "@/lib/types";
import type { Contribution, DuesSummary, WelfareCase, WelfareStatus } from "@osaja/types";
import { formatDate } from "@osaja/utils";

export default function DashboardPage() {
  const { member } = useAuth();
  const compact = member?.preferences?.compactDashboard ?? false;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dues, setDues] = useState<DuesSummary | null>(null);
  const [unread, setUnread] = useState(0);
  const [birthdays, setBirthdays] = useState(0);
  const [activeVotes, setActiveVotes] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [recentPayments, setRecentPayments] = useState<Contribution[]>([]);
  const [welfareCases, setWelfareCases] = useState<WelfareCase[]>([]);
  const [voteResults, setVoteResults] = useState<PublishedVoteResult[]>([]);

  const WELFARE_LABELS: Record<WelfareStatus, string> = {
    pending: "Pending review",
    approved: "Approved",
    allocated: "Support allocated",
    resolved: "Resolved",
    archived: "Archived",
  };

  const loadDashboard = () => {
    if (!member) return;

    setLoading(true);
    setLoadError("");
    const month = new Date().getMonth() + 1;
    const notifLimit = compact ? 2 : 4;
    const welfareLimit = compact ? 2 : 3;
    const paymentLimit = compact ? 2 : 3;
    const resultsLimit = compact ? 1 : 2;

    Promise.all([
      apiFetch<Record<string, unknown>>("/members/me/dues"),
      apiFetch<{ count: number }>("/notifications/unread-count"),
      apiFetch<NotificationItem[]>("/notifications?unread_only=false"),
      apiFetch<{ day: number }[]>(`/dashboard/birthdays?month=${month}`),
      apiFetch<Record<string, unknown>[]>("/voting"),
      apiFetch<{ items: Record<string, unknown>[] }>(
        `/members/me/contributions?page=1&page_size=${paymentLimit}`
      ),
      apiFetch<{ items: Record<string, unknown>[] }>(
        `/welfare/me/cases?page=1&page_size=${welfareLimit}`
      ),
      apiFetch<PublishedVoteResult[]>("/voting/published-results"),
    ])
      .then(([duesRes, unreadRes, notifRes, birthdaysRes, votesRes, contribRes, welfareRes, resultsRes]) => {
        setDues(mapDuesSummary(duesRes.data as Record<string, unknown>));
        setUnread(unreadRes.data?.count ?? 0);
        setNotifications((notifRes.data as NotificationItem[])?.slice(0, notifLimit) ?? []);
        setBirthdays(Array.isArray(birthdaysRes.data) ? birthdaysRes.data.length : 0);
        setActiveVotes(Array.isArray(votesRes.data) ? votesRes.data.length : 0);
        const items = (contribRes.data?.items ?? []) as Record<string, unknown>[];
        setRecentPayments(items.map(mapContribution));
        const wItems = welfareRes.data?.items ?? [];
        setWelfareCases(
          wItems.map((raw) => ({
            id: String(raw.id),
            memberId: String(raw.member_id),
            title: String(raw.title),
            description: String(raw.description),
            status: raw.status as WelfareStatus,
            createdAt: String(raw.created_at),
            updatedAt: String(raw.updated_at),
          }))
        );
        setVoteResults((resultsRes.data ?? []).slice(0, resultsLimit));
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, compact]);

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
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <PageHeader
        title={`Welcome, ${member?.fullName?.split(" ")[0] ?? "Member"}`}
        description={
          compact
            ? "Quick overview"
            : "Your welfare dashboard — dues, alerts, and community updates."
        }
      />

      {loadError ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {loadError}
          <button type="button" onClick={loadDashboard} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      {dues ? <DuesStatusBanner dues={dues} compact /> : null}

      <div
        className={
          compact
            ? "grid grid-cols-2 gap-2"
            : "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4"
        }
      >
        <StatCard
          label="Fund balance"
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

      <div className={compact ? "grid gap-4" : "grid gap-6 lg:grid-cols-2"}>
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
                    {!compact ? (
                      <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!compact ? (
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
                No payments recorded yet. Pay your monthly dues online on the Contributions page.
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
        ) : null}
      </div>

      {welfareCases.length > 0 ? (
        <section className="glass-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Welfare cases</h3>
            <Link href="/welfare" className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline">
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="space-y-3">
            {welfareCases.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50">
            <HeartHandshake className="h-6 w-6 text-purple-600" strokeWidth={1.75} />
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
            <h3 className="text-lg font-semibold text-slate-900">Vote results</h3>
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
