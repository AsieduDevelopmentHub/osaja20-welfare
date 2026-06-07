"use client";

import { formatCurrency } from "@osaja/utils";
import { BarChart3, Cake, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { apiFetch } from "@/lib/api";
import { downloadCsv, downloadExcel, fetchAllPages } from "@/lib/export";
import {
  mapMember,
  type AnnouncementItem,
  type ContributionItem,
  type DashboardStats,
  type VoteItem,
  type VoteResultsData,
  type WelfareCaseItem,
} from "@/lib/types";

type ExportFormat = "csv" | "excel";

export default function ReportsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");

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

  const save = (filename: string, rows: string[][]) => {
    if (format === "excel") downloadExcel(filename, rows);
    else downloadCsv(filename, rows);
  };

  const exportMembers = () =>
    run("members", async () => {
      const items = await fetchAllPages<Record<string, unknown>>("/members");
      const members = items.map((raw) => mapMember(raw));
      const rows: string[][] = [
        [
          "Full name",
          "Username",
          "Email",
          "Phone",
          "Date of birth",
          "Member ID",
          "Batch",
          "Status",
          "Role",
          "Email verified",
          "Registered",
        ],
        ...members.map((m) => [
          m.fullName,
          m.username ?? "",
          m.email,
          m.phoneNumber ?? "",
          m.dateOfBirth ?? "",
          m.membershipId,
          String(m.batch),
          m.status,
          m.role ?? "",
          m.emailVerified ? "Yes" : "No",
          m.registrationDate ?? "",
        ]),
      ];
      save(`osaja-members-${dateStamp()}`, rows);
      setMessage(`Exported ${members.length} members as ${format.toUpperCase()}.`);
    });

  const exportContributions = () =>
    run("contributions", async () => {
      const items = await fetchAllPages<ContributionItem>("/contributions");
      const rows: string[][] = [
        ["Date", "Member", "Member ID", "Amount (GHS)", "Type", "Period", "Reference"],
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
      save(`osaja-contributions-${dateStamp()}`, rows);
      setMessage(`Exported ${items.length} contribution records.`);
    });

  const exportWelfare = () =>
    run("welfare", async () => {
      const items = await fetchAllPages<WelfareCaseItem>("/welfare/cases");
      const rows: string[][] = [
        ["Created", "Updated", "Member", "Member ID", "Title", "Status", "Description"],
        ...items.map((c) => [
          c.created_at,
          c.updated_at,
          c.member_name ?? "",
          c.membership_id ?? "",
          c.title,
          c.status,
          c.description,
        ]),
      ];
      save(`osaja-welfare-${dateStamp()}`, rows);
      setMessage(`Exported ${items.length} welfare cases.`);
    });

  const exportAnnouncements = () =>
    run("announcements", async () => {
      const res = await apiFetch<AnnouncementItem[]>("/announcements?limit=100");
      const items = res.data ?? [];
      const rows: string[][] = [
        ["Published", "Title", "Content", "Audience"],
        ...items.map((a) => [
          a.published_at ?? a.created_at,
          a.title,
          a.content,
          (a.target_audience ?? []).join("; "),
        ]),
      ];
      save(`osaja-announcements-${dateStamp()}`, rows);
      setMessage(`Exported ${items.length} announcements.`);
    });

  const exportVotes = () =>
    run("votes", async () => {
      const items = await fetchAllPages<VoteItem>("/voting/manage");
      const rows: string[][] = [
        [
          "Title",
          "Type",
          "Status",
          "Opens",
          "Closes",
          "Votes cast",
          "Results published",
          "Winner",
          "Option breakdown",
        ],
      ];
      for (const v of items) {
        let breakdown = "";
        let winner = "";
        if (v.status === "closed" || v.status === "result_published" || v.results_published) {
          try {
            const res = await apiFetch<VoteResultsData>(`/voting/${v.id}/results`);
            const data = res.data;
            if (data) {
              winner = data.winner_label ?? "";
              breakdown = data.results.map((r) => `${r.label}: ${r.count} (${r.percentage}%)`).join("; ");
            }
          } catch {
            /* skip results if unavailable */
          }
        }
        rows.push([
          v.title,
          v.vote_type,
          v.status,
          v.opens_at,
          v.closes_at,
          String(v.submission_count ?? 0),
          v.results_published ? "Yes" : "No",
          winner,
          breakdown,
        ]);
      }
      save(`osaja-votes-${dateStamp()}`, rows);
      setMessage(`Exported ${items.length} votes with results where available.`);
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
      save(`osaja-summary-${dateStamp()}`, rows);
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
    { key: "members", title: "Member roster", desc: "Full profiles with contact and role details", action: exportMembers },
    { key: "contributions", title: "Contribution ledger", desc: "All recorded payments and dues", action: exportContributions },
    { key: "welfare", title: "Welfare cases", desc: "Support requests and case status", action: exportWelfare },
    { key: "votes", title: "Votes & results", desc: "Ballots, turnout, and published outcomes", action: exportVotes },
    { key: "announcements", title: "Announcements", desc: "Published notices to members", action: exportAnnouncements },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Reports & exports"
        description="Download accountability reports for executive meetings and audits."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-brand-navy/60 px-4 py-3">
        <span className="text-sm text-slate-400">Export format:</span>
        <div className="flex rounded-lg bg-white/10 p-0.5">
          <button
            type="button"
            onClick={() => setFormat("csv")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              format === "csv" ? "bg-brand-gold text-brand-navy-dark" : "text-slate-300"
            }`}
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => setFormat("excel")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
              format === "excel" ? "bg-brand-gold text-brand-navy-dark" : "text-slate-300"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
        </div>
      </div>

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
                  {busy === card.key ? "Exporting..." : `Download ${format === "excel" ? "Excel" : "CSV"}`}
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
              <p className="mt-1 text-sm text-slate-400">Scan members with birthdays today and send greetings.</p>
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
