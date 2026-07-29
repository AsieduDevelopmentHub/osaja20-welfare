"use client";

import { useEffect, useState } from "react";
import { History, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";

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
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand-gold">SMS Portal</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">History</h1>
        <p className="mt-1 text-sm text-slate-400">
          Search delivery records. Use refresh to pull the latest status from Arkesel when a message id exists.
        </p>
      </header>

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

      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
          <History className="mx-auto h-10 w-10 text-brand-gold" />
          <p className="mt-4 text-sm font-semibold text-white">No SMS history yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data?.items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  {item.member_name || item.recipient_phone}
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs capitalize text-slate-300">
                    {item.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => refreshStatus(item.id)}
                    disabled={refreshingId === item.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-brand-gold disabled:opacity-50"
                    title="Refresh delivery status from Arkesel"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === item.id ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {item.recipient_phone} · {item.cost_units} unit(s)
                {item.created_at ? ` · ${new Date(item.created_at).toLocaleString()}` : ""}
              </p>
              <p className="mt-2 text-sm text-slate-300">{item.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
