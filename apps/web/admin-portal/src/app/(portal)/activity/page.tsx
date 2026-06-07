"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatDate } from "@osaja/utils";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { apiFetch } from "@/lib/api";

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  actor: { full_name: string; membership_id: string } | null;
}

interface ActivityResponse {
  items: ActivityItem[];
  total: number;
  page: number;
  total_pages: number;
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<ActivityResponse>(`/activity?page=${page}&page_size=50`);
      setData(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <AdminHeader
        title="Activity log"
        description="Audit trail of executive actions across the platform."
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListRowsSkeleton variant="dark" rows={8} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-brand-navy/60">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {(data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                data?.items.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {row.actor ? (
                        <span>
                          {row.actor.full_name}
                          <span className="ml-1 text-xs text-slate-500">({row.actor.membership_id})</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-brand-gold">{row.action}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.entity_type}
                      <span className="ml-1 font-mono text-xs text-slate-600">
                        {row.entity_id.slice(0, 8)}…
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total_pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <span>
            Page {data.page} of {data.total_pages} ({data.total} events)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
