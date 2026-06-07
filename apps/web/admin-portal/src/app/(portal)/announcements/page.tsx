"use client";

import { formatDate } from "@osaja/utils";
import { Loader2, Megaphone, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { apiFetch } from "@/lib/api";
import type { AnnouncementItem } from "@/lib/types";

export default function AnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AnnouncementItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetch<AnnouncementItem[]>("/announcements");
      setHistory(res.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await apiFetch("/announcements", {
        method: "POST",
        body: JSON.stringify({ title, content, target_audience: ["all"], notify_members: true }),
      });
      setMessage("Announcement published — members notified in-app (push when configured).");
      setTitle("");
      setContent("");
      await loadHistory();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Announcements"
        description="Publish to all members — creates in-app notifications instantly."
      />

      <form onSubmit={publish} className="space-y-4 rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Announcement title"
          className="input-dark"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={5}
          placeholder="Write your announcement..."
          className="input-dark"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold py-3 font-semibold text-brand-navy-dark disabled:opacity-50 sm:w-auto sm:px-6"
        >
          <Send className="h-5 w-5" />
          {loading ? "Publishing..." : "Publish & notify"}
        </button>
        {message ? <p className="text-sm text-brand-gold">{message}</p> : null}
      </form>

      <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
        <h2 className="mb-4 font-semibold text-white">Recent announcements</h2>
        {historyLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400">No announcements published yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {history.map((a) => (
              <li key={a.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-white">{a.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{a.content}</p>
                  </div>
                  <time className="shrink-0 text-xs text-slate-500">
                    {a.published_at ? formatDate(a.published_at) : formatDate(a.created_at)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-400">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" />
        <p>
          Notifications are created synchronously. Web Push uses stored subscriptions when VAPID keys are configured.
        </p>
      </div>
    </div>
  );
}
