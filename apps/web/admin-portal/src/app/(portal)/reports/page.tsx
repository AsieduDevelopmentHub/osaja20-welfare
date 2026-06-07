"use client";

import { formatCurrency } from "@osaja/utils";
import { BarChart3, Cake, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/export";
import { mapMember, type ContributionItem, type DashboardStats, type MemberListResponse, type PaginatedResponse, type WelfareCaseItem } from "@/lib/types";

export default function ReportsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const exportMembers = () =>
    run("members", async () => {
      const res = await apiFetch<MemberListResponse>("/members?page=1&page_size=500");
      const items = (res.data?.items ?? []).map((raw) => mapMember(raw));
      const rows: string[][] = [
        ["Full name", "Username", "Email", "Phone", "Member ID", "Batch", "Status", "Role", "Registered"],
        ...items.map((m) => [
          m.fullName,
          m.username ?? "",
          m.email,
          m.phoneNumber ?? "",
          m.membershipId,
          String(m.batch),
          m.status,
          m.role ?? "",
          m.registrationDate ?? "",
        ]),
      ];
      downloadCsv(`osaja-members-${dateStamp()}.csv`, rows);
      setMessage(`Exported ${items.length} members.`);
    });

  const exportContributions = () =>
    run("contributions", async () => {
      const res = await apiFetch<PaginatedResponse<ContributionItem>>("/contributions?page=1&page_size=500");
      const items = res.data?.items ?? [];
      const rows: string[][] = [
        ["Date", "Member", "Member ID", "Amount", "Type", "Period", "Reference"],
        ...items.map((c) => [
          c.created_at,
          c.member_name ?? "",
          c.membership_id ?? "",
          String(c.amount),
          c.type,
          c.period_year && c.period_month ? `${c.period_month}/${c.period_year}` : "",
          c.reference,
        ]),
      ];
      downloadCsv(`osaja-contributions-${dateStamp()}.csv`, rows);
      setMessage(`Exported ${items.length} contribution records.`);
    });

  const exportWelfare = () =>
    run("welfare", async () => {
      const res = await apiFetch<PaginatedResponse<WelfareCaseItem>>("/welfare/cases?page=1&page_size=500");
      const items = res.data?.items ?? [];
      const rows: string[][] = [
        ["Created", "Member", "Member ID", "Title", "Status", "Description"],
        ...items.map((c) => [
          c.created_at,
          c.member_name ?? "",
          c.membership_id ?? "",
          c.title,
          c.status,
          c.description,
        ]),
      ];
      downloadCsv(`osaja-welfare-${dateStamp()}.csv`, rows);
      setMessage(`Exported ${items.length} welfare cases.`);
    });

  const exportSummary = () =>
    run("summary", async () => {
      const res = await apiFetch<DashboardStats>("/dashboard/stats");
      const s = res.data;
      if (!s) throw new Error("No stats returned");
      const rows: string[][] = [
        ["Metric", "Value"],
        ["Total members", String(s.total_members)],
        ["Active members", String(s.active_members)],
        ["Pending welfare cases", String(s.pending_welfare_cases)],
        ["Total contributions", formatCurrency(s.total_contributions)],
        ["Active votes", String(s.active_votes)],
        ["Birthdays today", String(s.upcoming_birthdays_today)],
        ["Exported at", new Date().toISOString()],
      ];
      downloadCsv(`osaja-summary-${dateStamp()}.csv`, rows);
      setMessage("Dashboard summary exported.");
    });

  const scanBirthdays = () =>
    run("birthdays", async () => {
      const res = await apiFetch<{ created: number }>("/notifications/scan-birthdays", { method: "POST" });
      const n = (res.data as { created?: number })?.created ?? 0;
      setMessage(n > 0 ? `Sent ${n} birthday notification(s).` : "No new birthday notifications today.");
    });

  const cards = [
    { key: "summary", title: "Dashboard summary", desc: "Member counts, fund total, votes, birthdays", action: exportSummary },
    { key: "members", title: "Member roster", desc: "Full member list with roles and status", action: exportMembers },
    { key: "contributions", title: "Contribution ledger", desc: "All recorded payments and dues", action: exportContributions },
    { key: "welfare", title: "Welfare cases", desc: "Case queue with status and descriptions", action: exportWelfare },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Reports & exports"
        description="Download CSV reports for records, audits, and executive meetings."
      />

      {message ? <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/20">
                <BarChart3 className="h-5 w-5 text-brand-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-white">{card.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{card.desc}</p>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={card.action}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy-dark disabled:opacity-50"
                >
                  {busy === card.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {busy === card.key ? "Exporting..." : "Download CSV"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Cake className="mt-1 h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-semibold text-white">Birthday notifications</h2>
              <p className="mt-1 text-sm text-slate-400">
                Scan members with birthdays today and send in-app (and push) greetings.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={scanBirthdays}
            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            {busy === "birthdays" ? "Scanning..." : "Run birthday scan"}
          </button>
        </div>
      </section>
    </div>
  );
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
