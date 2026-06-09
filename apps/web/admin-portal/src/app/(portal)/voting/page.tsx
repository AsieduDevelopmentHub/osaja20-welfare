"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatDate } from "@osaja/utils";
import { Plus, Vote } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { VoteResultsPanel } from "@/components/VoteResultsPanel";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, VoteItem, VoteResultsData } from "@/lib/types";
import { VOTE_STATUS_LABELS } from "@/lib/types";

export default function VotingPage() {
  const [votes, setVotes] = useState<VoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<VoteResultsData | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [voteType, setVoteType] = useState("decision");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [options, setOptions] = useState(["Yes", "No", "Abstain"]);
  const [minContribution, setMinContribution] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<PaginatedResponse<VoteItem>>("/voting/manage?page=1&page_size=50");
      setVotes(res.data?.items ?? []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load votes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createVote = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await apiFetch("/voting", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          vote_type: voteType,
          opens_at: new Date(opensAt).toISOString(),
          closes_at: new Date(closesAt).toISOString(),
          minimum_contribution: minContribution ? Number(minContribution) : null,
          options: options.filter((o) => o.trim()).map((label) => ({ label: label.trim() })),
        }),
      });
      setMessage("Vote created as draft. Open it when ready.");
      setShowForm(false);
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create vote");
    } finally {
      setBusy(false);
    }
  };

  const openVote = async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/voting/${id}/open`, { method: "PATCH" });
      setMessage("Vote is now open for members.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to open vote");
    } finally {
      setBusy(false);
    }
  };

  const closeVote = async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/voting/${id}/close`, { method: "PATCH" });
      setMessage("Vote closed. Publish results when ready for members to see them.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to close vote");
    } finally {
      setBusy(false);
    }
  };

  const publishResults = async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/voting/${id}/publish-results`, { method: "PATCH" });
      setMessage("Results published — members can view for 7 days (auto-hidden after).");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to publish results");
    } finally {
      setBusy(false);
    }
  };

  const archiveVote = async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/voting/${id}/archive`, { method: "PATCH" });
      setMessage("Vote archived and removed from member views.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to archive vote");
    } finally {
      setBusy(false);
    }
  };

  const unpublishResults = async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/voting/${id}/unpublish-results`, { method: "PATCH" });
      setMessage("Results hidden from members.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to unpublish results");
    } finally {
      setBusy(false);
    }
  };

  const loadResults = async (id: string) => {
    setBusy(true);
    try {
      const res = await apiFetch<VoteResultsData>(`/voting/${id}/results`);
      setResults(res.data ?? null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Voting"
        description="Create elections and decisions, open ballots, and view results."
        action={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark"
          >
            <Plus className="h-4 w-4" />
            New vote
          </button>
        }
      />

      {message ? <p className="rounded-xl bg-brand-gold/10 px-4 py-3 text-sm text-brand-gold">{message}</p> : null}

      {showForm ? (
        <form onSubmit={createVote} className="space-y-4 rounded-2xl border border-white/10 bg-brand-navy/60 p-5">
          <h2 className="font-semibold text-white">Create vote</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Vote title"
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Description (optional)"
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Type</label>
              <select
                value={voteType}
                onChange={(e) => setVoteType(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-white"
              >
                <option value="decision">Decision</option>
                <option value="election">Election</option>
                <option value="multi_choice">Multi-choice</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Min. contribution (GHS)</label>
              <input
                type="number"
                min={0}
                value={minContribution}
                onChange={(e) => setMinContribution(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Opens</label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Closes</label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs text-slate-400">Options (one per line)</label>
            {options.map((opt, i) => (
              <input
                key={i}
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-white"
              />
            ))}
            <button
              type="button"
              onClick={() => setOptions((o) => [...o, ""])}
              className="text-xs text-brand-gold hover:underline"
            >
              + Add option
            </button>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-50"
          >
            {busy ? "Creating..." : "Create draft vote"}
          </button>
        </form>
      ) : null}

      {loading ? (
        <ListRowsSkeleton rows={4} variant="dark" />
      ) : votes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-brand-navy/60 p-10 text-center text-slate-400">
          <Vote className="mx-auto mb-3 h-10 w-10" />
          No votes yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {votes.map((v) => (
            <li key={v.id} className="rounded-2xl border border-white/10 bg-brand-navy/60 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-semibold text-white">{v.title}</p>
                  {v.description ? <p className="mt-1 text-sm text-slate-400">{v.description}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(v.opens_at)} → {formatDate(v.closes_at)} · {v.submission_count ?? 0} votes cast
                  </p>
                </div>
                <span className="self-start rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200">
                  {VOTE_STATUS_LABELS[v.status] ?? v.status}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                {v.status === "draft" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openVote(v.id)}
                    className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300"
                  >
                    Open vote
                  </button>
                ) : null}
                {v.status === "open" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => closeVote(v.id)}
                    className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-300"
                  >
                    Close vote
                  </button>
                ) : null}
                {(v.status === "closed" || v.status === "result_published") && !v.results_published ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => publishResults(v.id)}
                    className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300"
                  >
                    Publish results to members
                  </button>
                ) : null}
                {v.results_published ? (
                  <>
                    <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-slate-300">
                      Results live · auto-hides after 7 days
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unpublishResults(v.id)}
                      className="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-300"
                    >
                      Unpublish
                    </button>
                  </>
                ) : null}
                {v.status === "closed" || v.status === "result_published" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => archiveVote(v.id)}
                    className="rounded-lg bg-slate-600/30 px-3 py-1.5 text-xs font-medium text-slate-300"
                  >
                    Archive
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => loadResults(v.id)}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
                >
                  View results
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {results ? <VoteResultsPanel data={results} onClose={() => setResults(null)} /> : null}
    </div>
  );
}
