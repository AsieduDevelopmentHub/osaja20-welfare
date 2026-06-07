"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatDate } from "@osaja/utils";
import { Pencil, Send, Trash2 } from "lucide-react";
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
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [reNotify, setReNotify] = useState(false);

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
      setMessage("Announcement published — members notified in-app and via push.");
      setTitle("");
      setContent("");
      await loadHistory();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item: AnnouncementItem) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditContent(item.content);
    setReNotify(false);
    setMessage("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    setMessage("");
    try {
      await apiFetch(`/announcements/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          notify_members: reNotify,
        }),
      });
      setMessage(reNotify ? "Announcement updated and members re-notified." : "Announcement updated.");
      setEditing(null);
      await loadHistory();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this announcement from the member feed?")) return;
    setLoading(true);
    setMessage("");
    try {
      await apiFetch(`/announcements/${id}`, { method: "DELETE" });
      setMessage("Announcement removed.");
      if (editing?.id === id) setEditing(null);
      await loadHistory();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Announcements"
        description="Publish to all members — in-app notifications and push alerts for subscribed devices."
      />

      {editing ? (
        <form onSubmit={saveEdit} className="space-y-4 rounded-2xl border border-brand-gold/30 bg-brand-navy/60 p-5 sm:p-6">
          <h2 className="font-semibold text-white">Edit announcement</h2>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required className="input-dark" />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            required
            rows={5}
            className="input-dark"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={reNotify} onChange={(e) => setReNotify(e.target.checked)} />
            Re-notify all members (in-app + push)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
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
        </form>
      )}

      {message ? <p className="text-sm text-brand-gold">{message}</p> : null}

      <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
        <h2 className="mb-4 font-semibold text-white">Recent announcements</h2>
        {historyLoading ? (
          <ListRowsSkeleton rows={4} variant="dark" />
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400">No announcements published yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {history.map((a) => (
              <li key={a.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{a.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{a.content}</p>
                    <time className="mt-2 block text-xs text-slate-500">
                      {a.published_at ? formatDate(a.published_at) : formatDate(a.created_at)}
                    </time>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={loading}
                      className="flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
