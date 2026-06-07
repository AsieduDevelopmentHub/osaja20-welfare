"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatDate } from "@osaja/utils";
import { Megaphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  published_at: string | null;
  created_at: string;
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<AnnouncementItem[]>("/announcements");
      setItems(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load announcements");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Official updates from the welfare executive team."
      />

      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
          <button type="button" onClick={load} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <ListRowsSkeleton variant="light" rows={5} />
      ) : items.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-2 p-10 text-slate-500">
          <Megaphone className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
          <p>No announcements yet.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="glass-card p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {item.published_at ? formatDate(item.published_at) : formatDate(item.created_at)}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {item.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
