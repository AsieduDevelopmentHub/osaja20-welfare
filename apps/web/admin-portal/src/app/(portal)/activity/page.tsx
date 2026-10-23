"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatDate } from "@osaja/utils";
import { Activity, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Alert, EmptyState, FilterPills, PaginationBar } from "@/components/ui";
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

const ENTITY_FILTERS = [
  { value: "", label: "All entities" },
  { value: "contribution", label: "Contributions" },
  { value: "member", label: "Members" },
  { value: "welfare_case", label: "Welfare" },
  { value: "vote", label: "Voting" },
  { value: "announcement", label: "Announcements" },
  { value: "support_inquiry", label: "Inquiries" },
  { value: "notification", label: "Notifications" },
];

const ACTION_FILTERS = [
  { value: "", label: "All actions" },
  { value: "contribution_recorded", label: "Contribution recorded" },
  { value: "member_role_updated", label: "Role updated" },
  { value: "welfare_transition", label: "Welfare transition" },
  { value: "vote_opened", label: "Vote opened" },
  { value: "vote_closed", label: "Vote closed" },
  { value: "announcement_published", label: "Announcement published" },
  { value: "support_inquiry_replied", label: "Inquiry replied" },
];

function actionLabel(action: string) {
  return action.replace(/_/g, " ");
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "50",
      });
      if (entityType) params.set("entity_type", entityType);
      if (action) params.set("action", action);
      const res = await apiFetch<ActivityResponse>(`/activity?${params.toString()}`);
      setData(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Activity}
        title="Activity log"
        description="Audit trail of executive actions across the platform."
        action={
          <button type="button" onClick={load} disabled={loading} className="btn-ghost">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="space-y-3">
        <FilterPills
          options={ENTITY_FILTERS}
          value={entityType}
          onChange={(v) => {
            setEntityType(v);
            setPage(1);
          }}
        />
        <FilterPills
          options={ACTION_FILTERS}
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
        />
      </div>

      {error ? (
        <Alert tone="error" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <ListRowsSkeleton variant="dark" rows={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity found"
          description={
            entityType || action
              ? "Try clearing filters to see more events."
              : "Executive actions will appear here as they happen."
          }
        />
      ) : (
        <div className="admin-panel">
          {/* Mobile cards */}
          <ul className="divide-y divide-white/5 md:hidden">
            {items.map((row) => (
              <li key={row.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium capitalize text-brand-gold">{actionLabel(row.action)}</p>
                  <p className="shrink-0 text-xs text-slate-500">{formatDate(row.created_at)}</p>
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  {row.actor ? (
                    <>
                      {row.actor.full_name}
                      <span className="text-slate-500"> · {row.actor.membership_id}</span>
                    </>
                  ) : (
                    <span className="text-slate-500">System</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.entity_type}
                  <span className="ml-1 font-mono text-slate-600">{row.entity_id.slice(0, 8)}…</span>
                </p>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {items.map((row) => (
                  <tr key={row.id} className="transition hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-6 py-3 text-slate-400">{formatDate(row.created_at)}</td>
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
                    <td className="px-4 py-3 font-medium capitalize text-brand-gold">{actionLabel(row.action)}</td>
                    <td className="px-6 py-3 text-slate-400">
                      {row.entity_type}
                      <span className="ml-1 font-mono text-xs text-slate-600">
                        {row.entity_id.slice(0, 8)}…
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/10 px-4 py-3 sm:px-6">
            <PaginationBar
              page={data?.page ?? page}
              totalPages={data?.total_pages ?? 1}
              total={data?.total ?? 0}
              label="event"
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
