"use client";

import { Megaphone, Send } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function AnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Announcements</h1>
        <p className="text-sm text-slate-400">Publish to all members — creates in-app notifications instantly.</p>
      </header>

      <form onSubmit={publish} className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-850/80 p-4 sm:p-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Announcement title"
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white outline-none focus:border-brand-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={5}
          placeholder="Write your announcement..."
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 sm:w-auto sm:px-6"
        >
          <Send className="h-5 w-5" />
          {loading ? "Publishing..." : "Publish & notify"}
        </button>
        {message ? <p className="text-sm text-brand-300">{message}</p> : null}
      </form>

      <div className="flex items-start gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 text-sm text-slate-400">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
        <p>
          No Celery required — notifications are created synchronously. Web Push delivery will use stored
          subscriptions when VAPID keys are added.
        </p>
      </div>
    </div>
  );
}
