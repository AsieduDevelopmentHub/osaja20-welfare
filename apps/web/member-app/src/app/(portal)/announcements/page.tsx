"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatDate } from "@osaja/utils";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  published_at: string | null;
  created_at: string;
}

export default function AnnouncementsPage() {
  const { data: items = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.announcements,
    queryFn: async () => {
      const res = await apiFetch<AnnouncementItem[]>("/announcements");
      return res.data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Megaphone}
        title="Announcements"
        description="Official updates from the welfare executive team."
      />

      {error ? (
        <Alert tone="error">
          {error instanceof Error ? error.message : "Failed to load announcements"}{" "}
          <button type="button" onClick={() => refetch()} className="font-semibold underline">
            Retry
          </button>
        </Alert>
      ) : null}

      {isLoading ? (
        <ListRowsSkeleton variant="light" rows={5} />
      ) : items.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description="When the executive team publishes an update, it will appear here."
          />
        </div>
      ) : (
        <div className={`glass-card divide-y divide-slate-100 ${isFetching ? "opacity-90" : ""}`}>
          {items.map((item) => (
            <article key={item.id} className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {item.published_at ? formatDate(item.published_at) : formatDate(item.created_at)}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {item.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
