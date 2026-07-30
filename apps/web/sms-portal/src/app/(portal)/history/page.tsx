"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw, Search } from "lucide-react";
import { Skeleton } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsEmptyState, SmsPageHeader, SmsStatusBadge } from "@/components/sms-ui";

interface HistoryItem {
  id: string;
  campaign_id: string;
  member_name: string | null;
  recipient_phone: string;
  message: string;
  status: string;
  cost_units: number;
  created_at: string | null;
  provider_message_id?: string | null;
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  total_pages: number;
}

export default function HistoryPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: "1", page_size: "30" });
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    apiFetch<HistoryResponse>(`/sms/history?${params}`)
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const handle = window.setTimeout(load, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const refreshStatus = async (id: string) => {
    setRefreshingId(id);
    setError("");
    try {
      await apiFetch(`/sms/messages/${id}/refresh`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh status");
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <SmsPageHeader
        title="History"
        description="Search delivery records. Refresh pulls the latest status from Arkesel when a message id exists."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search phone or message"
            className="input-dark pl-10 outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input-dark outline-none focus:border-brand-gold sm:w-44"
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="scheduled">Scheduled</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="invalid">Invalid</option>
        </select>
      </div>

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="dark" className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <SmsEmptyState icon={History} title="No SMS history yet" description="Sent messages will appear here." />
      ) : (
        <ul className="space-y-3">
          {data?.items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  {item.member_name || item.recipient_phone}
                </p>
                <div className="flex items-center gap-2">
                  <SmsStatusBadge status={item.status} />
                  <button
                    type="button"
                    onClick={() => refreshStatus(item.id)}
                    disabled={refreshingId === item.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-brand-gold disabled:opacity-50"
                    title="Refresh delivery status from Arkesel"
                    aria-label="Refresh delivery status"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === item.id ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {item.recipient_phone} · {item.cost_units} unit(s)
                {item.created_at ? ` · ${new Date(item.created_at).toLocaleString()}` : ""}
              </p>
              <p className="mt-2 line-clamp-3 text-sm text-slate-300">{item.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
