"use client";

import type { DuesSummary, Member } from "@osaja/types";
import { ContributionLedger, ListRowsSkeleton, type LedgerItem } from "@osaja/ui";
import { formatCurrency, formatDate, periodLabel } from "@osaja/utils";
import { Check, Clock, Filter, Minus, RefreshCw, UserRound, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MemberSearchInput } from "@/components/MemberSearchInput";
import { FilterPills, PaginationBar } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type {
  ContributionItem,
  OwingListResponse,
  OwingMemberItem,
  PaginatedResponse,
} from "@/lib/types";

function mapDuesSummary(raw: Record<string, unknown>): DuesSummary {
  const currentMonth = (raw.current_month as Record<string, unknown>) ?? {};
  const periods = (raw.periods as Record<string, unknown>[]) ?? [];
  return {
    monthlyAmount: Number(raw.monthly_amount ?? 30),
    currency: String(raw.currency ?? "GHS"),
    balance: Number(raw.balance ?? 0),
    currentMonth: {
      year: Number(currentMonth.year),
      month: Number(currentMonth.month),
      label: String(currentMonth.label ?? ""),
    },
    currentStatus: raw.current_status as DuesSummary["currentStatus"],
    arrearsCount: Number(raw.arrears_count ?? 0),
    totalOwed: Number(raw.total_owed ?? 0),
    totalPaidMonths: Number(raw.total_paid_months ?? 0),
    periods: periods.map((p) => ({
      year: Number(p.year),
      month: Number(p.month),
      label: String(p.label),
      amount: Number(p.amount),
      status: p.status as DuesSummary["periods"][0]["status"],
      paidAmount: Number(p.paid_amount ?? 0),
    })),
  };
}

type TrackingView = "all" | "owing" | "member";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString("en-GH", { month: "long" }),
}));

function toLedgerItem(c: ContributionItem): LedgerItem {
  return {
    id: c.id,
    date: formatDate(c.created_at),
    amount: c.amount,
    type: c.type,
    reference: c.reference,
    period:
      c.period_month && c.period_year ? periodLabel(c.period_year, c.period_month) : undefined,
    subtitle: c.member_name
      ? `${c.member_name} (${c.membership_id})`
      : c.membership_id,
  };
}

function statusStyles(status: string) {
  if (status === "overdue") return "bg-red-500/15 text-red-300 ring-red-500/30";
  if (status === "due") return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
}

export function ContributionTrackingPanel({
  onError,
}: {
  onError?: (message: string) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [view, setView] = useState<TrackingView>("all");
  const [periodMonth, setPeriodMonth] = useState<number | "">("");
  const [periodYear, setPeriodYear] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState<ContributionItem[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPages, setLedgerPages] = useState(1);
  const [owing, setOwing] = useState<OwingMemberItem[]>([]);
  const [owingTotal, setOwingTotal] = useState(0);
  const [owingPages, setOwingPages] = useState(1);
  const [owingSummary, setOwingSummary] = useState({ owing_count: 0, total_outstanding: 0 });
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberDues, setMemberDues] = useState<DuesSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const reportError = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError]
  );

  const loadMemberDues = useCallback(
    async (memberId: string) => {
      try {
        const res = await apiFetch<Record<string, unknown>>(`/members/${memberId}/dues`);
        if (res.data) setMemberDues(mapDuesSummary(res.data));
        else setMemberDues(null);
      } catch {
        setMemberDues(null);
      }
    },
    []
  );

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "20",
      });
      if (view === "member" && selectedMember) {
        params.set("member_id", selectedMember.id);
      }
      if (periodYear !== "") params.set("period_year", String(periodYear));
      if (periodMonth !== "") params.set("period_month", String(periodMonth));

      const res = await apiFetch<PaginatedResponse<ContributionItem>>(
        `/contributions?${params.toString()}`
      );
      const data = res.data;
      setLedger(data?.items ?? []);
      setLedgerTotal(data?.total ?? 0);
      setLedgerPages(data?.total_pages ?? 1);
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Failed to load contributions");
    } finally {
      setLoading(false);
    }
  }, [page, periodMonth, periodYear, reportError, selectedMember, view]);

  const loadOwing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<OwingListResponse>(
        `/contributions/owing?page=${page}&page_size=20`
      );
      const data = res.data;
      setOwing(data?.items ?? []);
      setOwingTotal(data?.total ?? 0);
      setOwingPages(data?.total_pages ?? 1);
      setOwingSummary(data?.summary ?? { owing_count: 0, total_outstanding: 0 });
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Failed to load owing members");
    } finally {
      setLoading(false);
    }
  }, [page, reportError]);

  useEffect(() => {
    if (view === "owing") {
      loadOwing();
      return;
    }
    if (view === "member" && !selectedMember) {
      setLedger([]);
      setLedgerTotal(0);
      setLedgerPages(1);
      setMemberDues(null);
      setLoading(false);
      return;
    }
    loadLedger();
  }, [view, selectedMember, loadLedger, loadOwing]);

  useEffect(() => {
    if (view === "member" && selectedMember) {
      loadMemberDues(selectedMember.id);
    } else if (view !== "member") {
      setMemberDues(null);
    }
  }, [view, selectedMember, loadMemberDues]);

  const switchView = (next: TrackingView) => {
    setView(next);
    setPage(1);
  };

  const clearPeriodFilters = () => {
    setPeriodMonth("");
    setPeriodYear("");
    setPage(1);
  };

  const openMember = (member: Member) => {
    setSelectedMember(member);
    setView("member");
    setPage(1);
  };

  const openOwingMember = (row: OwingMemberItem) => {
    openMember({
      id: row.member_id,
      fullName: row.member_name,
      username: "",
      email: row.email,
      phoneNumber: row.phone_number,
      dateOfBirth: "",
      membershipId: row.membership_id,
      batch: 0,
      status: "active",
      role: "member",
      emailVerified: true,
      registrationDate: "",
    });
  };

  const yearOptions = useMemo(() => {
    const start = 2025;
    const end = now.getFullYear() + 1;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [now]);

  const hasPeriodFilter = periodMonth !== "" || periodYear !== "";

  const periodToolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[140px] flex-1 sm:flex-none">
          <label className="mb-1 block text-xs text-slate-400">Month</label>
          <select
            value={periodMonth}
            onChange={(e) => {
              setPeriodMonth(e.target.value ? Number(e.target.value) : "");
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-gold"
          >
            <option value="">All months</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[120px] flex-1 sm:flex-none">
          <label className="mb-1 block text-xs text-slate-400">Year</label>
          <select
            value={periodYear}
            onChange={(e) => {
              setPeriodYear(e.target.value ? Number(e.target.value) : "");
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-gold"
          >
            <option value="">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {hasPeriodFilter ? (
          <button
            type="button"
            onClick={clearPeriodFilters}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => (view === "owing" ? loadOwing() : loadLedger())}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills<TrackingView>
          options={[
            { value: "all", label: "All contributions" },
            { value: "owing", label: "Owing members" },
            { value: "member", label: "By member" },
          ]}
          value={view}
          onChange={switchView}
        />
        {view === "owing" && owingSummary.owing_count > 0 ? (
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-amber-200">{owingSummary.owing_count}</span> owing ·{" "}
            <span className="font-semibold text-brand-gold">
              {formatCurrency(owingSummary.total_outstanding)}
            </span>{" "}
            outstanding
          </p>
        ) : null}
      </div>

      {view === "owing" ? (
        <section className="admin-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
            <div>
              <h3 className="font-semibold text-white">Members with outstanding dues</h3>
              <p className="mt-0.5 text-sm text-slate-400">
                Arrears plus unpaid current month · tap a row to see their monthly contributions
              </p>
            </div>
            <button type="button" onClick={loadOwing} className="btn-ghost">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-4 sm:p-6">
              <ListRowsSkeleton rows={6} variant="dark" />
            </div>
          ) : owing.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Users className="h-8 w-8 text-slate-500" />
              <p className="text-sm text-slate-400">Everyone is up to date — no outstanding dues.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="divide-y divide-white/5 md:hidden">
                {owing.map((row) => (
                  <li key={row.member_id}>
                    <button
                      type="button"
                      onClick={() => openOwingMember(row)}
                      className="w-full px-4 py-4 text-left transition hover:bg-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{row.member_name}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{row.membership_id}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusStyles(row.current_status)}`}
                        >
                          {row.current_status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white/5 px-3 py-2">
                          <p className="text-slate-500">Arrears</p>
                          <p className="mt-0.5 font-semibold text-slate-200">
                            {row.arrears_count} mo · {formatCurrency(row.total_owed)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white/5 px-3 py-2">
                          <p className="text-slate-500">Outstanding</p>
                          <p className="mt-0.5 font-semibold text-brand-gold">
                            {formatCurrency(row.outstanding)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-6 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Arrears</th>
                      <th className="px-4 py-3 font-medium">Current due</th>
                      <th className="px-6 py-3 text-right font-medium">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {owing.map((row) => (
                      <tr
                        key={row.member_id}
                        className="cursor-pointer transition hover:bg-white/[0.03]"
                        onClick={() => openOwingMember(row)}
                      >
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-white">{row.member_name}</p>
                          <p className="text-xs text-slate-400">
                            {row.membership_id} · {row.email}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusStyles(row.current_status)}`}
                          >
                            {row.current_status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          {row.arrears_count > 0
                            ? `${row.arrears_count} mo · ${formatCurrency(row.total_owed)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          {row.current_due > 0 ? formatCurrency(row.current_due) : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-brand-gold">
                          {formatCurrency(row.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-white/10 px-4 py-3 sm:px-6">
                <PaginationBar
                  page={page}
                  totalPages={owingPages}
                  total={owingTotal}
                  label="owing member"
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          {view === "member" ? (
            <section className="admin-panel p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4 text-brand-gold" />
                <h3 className="text-sm font-semibold text-white">Find member</h3>
              </div>
              <MemberSearchInput
                selected={selectedMember}
                onSelect={(m) => {
                  setSelectedMember(m);
                  setPage(1);
                }}
                onClear={() => {
                  setSelectedMember(null);
                  setLedger([]);
                  setMemberDues(null);
                }}
              />
            </section>
          ) : null}

          {view === "member" && selectedMember && memberDues ? (
            <MemberDuesOverview dues={memberDues} />
          ) : null}

          {view === "member" && !selectedMember ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-brand-navy/40 px-5 py-12 text-center backdrop-blur-sm">
              <UserRound className="mx-auto h-8 w-8 text-slate-500" />
              <p className="mt-3 text-sm text-slate-400">
                Search and select a member to view their monthly contribution history.
              </p>
            </div>
          ) : loading ? (
            <ListRowsSkeleton rows={6} variant="dark" />
          ) : (
            <ContributionLedger
              variant="dark"
              title={
                view === "member" && selectedMember
                  ? `${selectedMember.fullName}'s contributions`
                  : "Contribution ledger"
              }
              description={
                hasPeriodFilter
                  ? `Filtered by ${periodMonth !== "" ? MONTHS[(periodMonth as number) - 1]?.label : "all months"} ${periodYear !== "" ? periodYear : ""}`.trim()
                  : view === "member"
                    ? "Monthly dues and other payments for this member"
                    : "All recorded contributions across the organisation"
              }
              emptyMessage={
                hasPeriodFilter
                  ? "No contributions match the selected month filters."
                  : "No contributions recorded yet."
              }
              items={ledger.map(toLedgerItem)}
              toolbar={periodToolbar}
              footer={
                <PaginationBar
                  page={page}
                  totalPages={ledgerPages}
                  total={ledgerTotal}
                  label="record"
                  onPageChange={setPage}
                />
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PERIOD_STYLES = {
  paid: {
    wrap: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
    icon: Check,
  },
  due: {
    wrap: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
    icon: Clock,
  },
  overdue: {
    wrap: "bg-red-500/15 text-red-300 ring-red-500/30",
    icon: X,
  },
  upcoming: {
    wrap: "bg-white/5 text-slate-400 ring-white/10",
    icon: Minus,
  },
} as const;

function MemberDuesOverview({ dues }: { dues: DuesSummary }) {
  const recent = [...dues.periods].reverse().slice(0, 12).reverse();
  const statusLabel =
    dues.currentStatus === "paid"
      ? "Paid this month"
      : dues.currentStatus === "overdue"
        ? "Overdue"
        : "Due this month";

  return (
    <section className="admin-panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dues overview</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{dues.currentMonth.label}</h3>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${statusStyles(dues.currentStatus)}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[280px]">
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Paid months</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-white">{dues.totalPaidMonths}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Arrears</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-amber-200">{dues.arrearsCount}</p>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Owed</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-brand-gold">
              {formatCurrency(dues.totalOwed)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6">
        {recent.map((p) => {
          const style = PERIOD_STYLES[p.status];
          const Icon = style.icon;
          return (
            <div
              key={`${p.year}-${p.month}`}
              title={`${p.label} — ${p.status}`}
              className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 ring-1 ${style.wrap}`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {MONTH_SHORT[p.month - 1]}
              </span>
              <span className="text-[10px] tabular-nums opacity-60">{String(p.year).slice(2)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
