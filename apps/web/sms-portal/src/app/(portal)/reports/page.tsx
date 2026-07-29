"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, MessageSquare, Percent, XCircle, Zap } from "lucide-react";
import { Skeleton, StatCard } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { downloadCsv, downloadExcel, fetchAllPages } from "@/lib/export";
import { SmsAlert, SmsPageHeader } from "@/components/sms-ui";

type ExportFormat = "csv" | "excel";

interface ReportsData {
  period: { label: string; start: string; as_of: string };
  messages: {
    sent_today: number;
    sent_this_month: number;
    delivered: number;
    submitted: number;
    failed: number;
    invalid: number;
    units_this_month: number;
    delivery_success_rate: number | null;
  };
  campaigns_by_status: Record<string, number>;
  recipient_groups: { id: string; label: string; count: number }[];
  workflows_count?: number;
}

interface HistoryItem {
  created_at: string | null;
  member_name: string | null;
  recipient_phone: string;
  status: string;
  cost_units: number;
  message: string;
  campaign_id: string;
}

interface CampaignItem {
  created_at: string | null;
  name: string;
  status: string;
  recipient_group: string;
  recipient_count: number;
  estimated_units: number;
  message: string;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>("excel");

  useEffect(() => {
    apiFetch<ReportsData>("/sms/reports")
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  const save = (filename: string, rows: string[][]) => {
    if (format === "excel") downloadExcel(filename, rows);
    else downloadCsv(filename, rows);
  };

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

  const exportSummary = () =>
    run("summary", async () => {
      if (!data) throw new Error("Reports not loaded");
      const m = data.messages;
      const rows: string[][] = [
        ["Metric", "Value"],
        ["Period", data.period.label],
        ["Sent today", String(m.sent_today)],
        ["Sent this month", String(m.sent_this_month)],
        ["Delivered", String(m.delivered)],
        ["Submitted", String(m.submitted)],
        ["Failed", String(m.failed)],
        ["Invalid", String(m.invalid)],
        ["Credits used", String(m.units_this_month)],
        [
          "Delivery success rate",
          m.delivery_success_rate != null ? `${m.delivery_success_rate}%` : "",
        ],
        ["Workflows", String(data.workflows_count ?? 0)],
      ];
      save(`osaja-sms-summary-${dateStamp()}`, rows);
      setMessage(`Summary exported as ${format.toUpperCase()}.`);
    });

  const exportHistory = () =>
    run("history", async () => {
      const items = await fetchAllPages<HistoryItem>("/sms/history");
      const rows: string[][] = [
        ["Date", "Member", "Phone", "Status", "Credits", "Campaign ID", "Message"],
        ...items.map((item) => [
          item.created_at ?? "",
          item.member_name ?? "",
          item.recipient_phone,
          item.status,
          String(item.cost_units),
          item.campaign_id,
          item.message,
        ]),
      ];
      save(`osaja-sms-history-${dateStamp()}`, rows);
      setMessage(`Exported ${items.length} history rows as ${format.toUpperCase()}.`);
    });

  const exportCampaigns = () =>
    run("campaigns", async () => {
      const items = await fetchAllPages<CampaignItem>("/sms/campaigns");
      const rows: string[][] = [
        ["Date", "Name", "Status", "Group", "Recipients", "Credits", "Message"],
        ...items.map((c) => [
          c.created_at ?? "",
          c.name,
          c.status,
          c.recipient_group,
          String(c.recipient_count),
          String(c.estimated_units),
          c.message,
        ]),
      ];
      save(`osaja-sms-campaigns-${dateStamp()}`, rows);
      setMessage(`Exported ${items.length} campaigns as ${format.toUpperCase()}.`);
    });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="dark" className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="dark" className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const m = data?.messages;

  return (
    <div className="space-y-5">
      <SmsPageHeader
        title="Reports"
        description={
          data
            ? `Performance for ${data.period.label}. Updated ${new Date(data.period.as_of).toLocaleString()}.`
            : "Usage and delivery performance."
        }
      />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}
      {message ? <SmsAlert variant="success">{message}</SmsAlert> : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Sent today" value={String(m?.sent_today ?? 0)} icon={MessageSquare} variant="dark" />
        <StatCard
          label="Sent this month"
          value={String(m?.sent_this_month ?? 0)}
          icon={Zap}
          iconClassName="text-brand-gold"
          variant="dark"
        />
        <StatCard
          label="Credits used"
          value={String(m?.units_this_month ?? 0)}
          icon={Zap}
          iconClassName="text-amber-300"
          variant="dark"
        />
        <StatCard
          label="Success rate"
          value={m?.delivery_success_rate != null ? `${m.delivery_success_rate}%` : "—"}
          icon={Percent}
          iconClassName="text-emerald-400"
          variant="dark"
        />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Exports</h2>
          <div className="inline-flex rounded-xl border border-white/10 p-1">
            <button
              type="button"
              onClick={() => setFormat("excel")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                format === "excel" ? "bg-brand-gold text-brand-navy-dark" : "text-slate-300"
              }`}
            >
              Excel
            </button>
            <button
              type="button"
              onClick={() => setFormat("csv")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                format === "csv" ? "bg-brand-gold text-brand-navy-dark" : "text-slate-300"
              }`}
            >
              CSV
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              key: "summary",
              title: "Monthly summary",
              desc: "Usage, credits, and delivery rates",
              action: exportSummary,
            },
            {
              key: "history",
              title: "Delivery history",
              desc: "All SMS delivery records",
              action: exportHistory,
            },
            {
              key: "campaigns",
              title: "Campaigns",
              desc: "Campaign names, groups, and status",
              action: exportCampaigns,
            },
          ].map((card) => (
            <div key={card.key} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <h3 className="text-sm font-semibold text-white">{card.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{card.desc}</p>
              <button
                type="button"
                onClick={card.action}
                disabled={busy === card.key}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-gold px-3 py-2 text-xs font-semibold text-brand-navy-dark hover:bg-brand-gold-light disabled:opacity-60"
              >
                {busy === card.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {busy === card.key ? "Exporting..." : `Download ${format === "excel" ? "Excel" : "CSV"}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Delivery breakdown</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Delivered</dt>
              <dd className="text-lg font-semibold text-emerald-300">{m?.delivered ?? 0}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Submitted</dt>
              <dd className="text-lg font-semibold text-sky-300">{m?.submitted ?? 0}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Failed</dt>
              <dd className="flex items-center gap-1 text-lg font-semibold text-red-300">
                <XCircle className="h-4 w-4" />
                {m?.failed ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Invalid</dt>
              <dd className="text-lg font-semibold text-amber-200">{m?.invalid ?? 0}</dd>
            </div>
          </dl>
          <Link href="/history" className="mt-4 inline-block text-xs font-semibold text-brand-gold hover:underline">
            Open full history →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Campaigns this month</h2>
          {Object.keys(data?.campaigns_by_status ?? {}).length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No campaigns yet this month.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {Object.entries(data?.campaigns_by_status ?? {}).map(([statusKey, count]) => (
                <li key={statusKey} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-slate-300">{statusKey}</span>
                  <span className="font-semibold text-white">{count}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/campaigns" className="mt-4 inline-block text-xs font-semibold text-brand-gold hover:underline">
            View campaigns →
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-white">Reachable members by group</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {(data?.recipient_groups ?? []).map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2.5 text-sm"
            >
              <span className="text-slate-300">{g.label}</span>
              <span className="font-semibold text-brand-gold">{g.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
