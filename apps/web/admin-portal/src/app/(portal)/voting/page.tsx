"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatDate } from "@osaja/utils";
import { Plus, Vote, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { VoteResultsPanel } from "@/components/VoteResultsPanel";
import { AdminPanel, Alert, EmptyState, FilterPills, FormSection } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, VoteItem, VoteResultsData } from "@/lib/types";
import { VOTE_STATUS_LABELS } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "", label: "Active" },
  { value: "draft", label: VOTE_STATUS_LABELS.draft },
  { value: "open", label: VOTE_STATUS_LABELS.open },
  { value: "closed", label: VOTE_STATUS_LABELS.closed },
  { value: "result_published", label: VOTE_STATUS_LABELS.result_published },
  { value: "archived", label: VOTE_STATUS_LABELS.archived },
];

export default function VotingPage() {
  const [votes, setVotes] = useState<VoteItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
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
      const q = statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : "";
      const res = await apiFetch<PaginatedResponse<VoteItem>>(`/voting/manage?page=1&page_size=50${q}`);
      setVotes(res.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load votes");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const createVote = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSuccess("");
    setError("");
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
      setSuccess("Vote created as draft. Open it when ready.");
      setShowForm(false);
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vote");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (fn: () => Promise<void>, okMessage: string) => {
    setBusy(true);
    setSuccess("");
    setError("");
    try {
      await fn();
      setSuccess(okMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const loadResults = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch<VoteResultsData>(`/voting/${id}/results`);
      setResults(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Vote}
        title="Voting"
        description="Create elections and decisions, open ballots, and view results."
        action={
          <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-gold">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Close" : "New vote"}
          </button>
        }
      />

      {success ? (
        <Alert tone="success" onDismiss={() => setSuccess("")}>
          {success}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      <FilterPills options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />

      {showForm ? (
        <AdminPanel>
          <form onSubmit={createVote} className="space-y-5">
            <FormSection step={1} title="Basics" description="Title, type, and optional eligibility.">
              <div className="space-y-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Vote title"
                  className="input-dark"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Description (optional)"
                  className="input-dark"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Type</label>
                    <select
                      value={voteType}
                      onChange={(e) => setVoteType(e.target.value)}
                      className="input-dark"
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
                      className="input-dark"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection step={2} title="Schedule" description="When ballots open and close.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Opens</label>
                  <input
                    type="datetime-local"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    required
                    className="input-dark"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Closes</label>
                  <input
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    required
                    className="input-dark"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection step={3} title="Options" description="One choice per field. Add more if needed.">
              <div>
                {options.map((opt, i) => (
                  <input
                    key={i}
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    className="input-dark mb-2"
                    placeholder={`Option ${i + 1}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setOptions((o) => [...o, ""])}
                  className="text-xs font-medium text-brand-gold hover:underline"
                >
                  + Add option
                </button>
              </div>
            </FormSection>

            <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
              <button type="submit" disabled={busy} className="btn-gold">
                {busy ? "Creating..." : "Create draft vote"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </AdminPanel>
      ) : null}

      {loading ? (
        <ListRowsSkeleton rows={4} variant="dark" />
      ) : votes.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="No votes yet"
          description={statusFilter ? "Try another status filter." : "Create a draft vote to get started."}
        />
      ) : (
        <ul className="space-y-3">
          {votes.map((v) => (
            <li key={v.id} className="admin-panel p-4 sm:p-5">
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
                    onClick={() =>
                      runAction(
                        () => apiFetch(`/voting/${v.id}/open`, { method: "PATCH" }).then(() => undefined),
                        "Vote is now open for members."
                      )
                    }
                    className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300"
                  >
                    Open vote
                  </button>
                ) : null}
                {v.status === "open" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        () => apiFetch(`/voting/${v.id}/close`, { method: "PATCH" }).then(() => undefined),
                        "Vote closed. Publish results when ready."
                      )
                    }
                    className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-300"
                  >
                    Close vote
                  </button>
                ) : null}
                {(v.status === "closed" || v.status === "result_published") && !v.results_published ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        () =>
                          apiFetch(`/voting/${v.id}/publish-results`, { method: "PATCH" }).then(
                            () => undefined
                          ),
                        "Results published — members can view for 7 days."
                      )
                    }
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
                      onClick={() =>
                        runAction(
                          () =>
                            apiFetch(`/voting/${v.id}/unpublish-results`, { method: "PATCH" }).then(
                              () => undefined
                            ),
                          "Results hidden from members."
                        )
                      }
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
                    onClick={() =>
                      runAction(
                        () => apiFetch(`/voting/${v.id}/archive`, { method: "PATCH" }).then(() => undefined),
                        "Vote archived."
                      )
                    }
                    className="rounded-lg bg-slate-600/30 px-3 py-1.5 text-xs font-medium text-slate-300"
                  >
                    Archive
                  </button>
                ) : null}
                {v.status === "archived" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        () =>
                          apiFetch(`/voting/${v.id}/unarchive`, { method: "PATCH" }).then(() => undefined),
                        "Vote restored from archive."
                      )
                    }
                    className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300"
                  >
                    Unarchive
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
