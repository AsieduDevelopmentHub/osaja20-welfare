"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatDate } from "@osaja/utils";
import type { WelfareCase, WelfareStatus } from "@osaja/types";
import { HeartHandshake, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STATUS_LABELS: Record<WelfareStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  allocated: "Support allocated",
  resolved: "Resolved",
};

const STATUS_COLORS: Record<WelfareStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-blue-50 text-blue-800 ring-blue-200",
  allocated: "bg-purple-50 text-purple-800 ring-purple-200",
  resolved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

function mapCase(raw: Record<string, unknown>): WelfareCase {
  return {
    id: String(raw.id),
    memberId: String(raw.member_id),
    title: String(raw.title),
    description: String(raw.description),
    status: raw.status as WelfareStatus,
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
  };
}

export default function WelfarePage() {
  const { member } = useAuth();
  const [cases, setCases] = useState<WelfareCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: Record<string, unknown>[] }>("/welfare/me/cases?page=1&page_size=50");
      setCases((res.data?.items ?? []).map(mapCase));
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/welfare/cases", {
        method: "POST",
        body: JSON.stringify({
          member_id: member.id,
          title: title.trim(),
          description: description.trim(),
        }),
      });
      setMessage("Your welfare request has been submitted. The executive team will review it.");
      setTitle("");
      setDescription("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Welfare"
          description="Track your support requests and see how your case is progressing."
        />
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary flex shrink-0 items-center gap-2 self-start"
        >
          <Plus className="h-4 w-4" />
          New request
        </button>
      </div>

      {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {showForm ? (
        <form onSubmit={submit} className="glass-card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold text-slate-900">Submit a welfare request</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            placeholder="Brief title (e.g. Medical support)"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            rows={4}
            placeholder="Describe your situation and what support you need..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
          />
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? "Submitting..." : "Submit request"}
          </button>
        </form>
      ) : null}

      {loading ? (
        <ListRowsSkeleton rows={4} variant="light" />
      ) : cases.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={HeartHandshake}
            title="No welfare cases yet"
            description="Submit a request if you need support from the welfare fund. You'll see status updates here as your case is reviewed."
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {cases.map((c) => (
            <li key={c.id} className="glass-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{c.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{c.description}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    STATUS_COLORS[c.status] ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Submitted {formatDate(c.createdAt)}
                {c.updatedAt !== c.createdAt ? ` · Updated ${formatDate(c.updatedAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
