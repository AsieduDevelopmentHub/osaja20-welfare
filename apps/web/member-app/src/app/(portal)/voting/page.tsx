"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { formatCurrency, formatDate } from "@osaja/utils";
import { AlertTriangle, CheckCircle2, Lock, Vote } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { mapVote } from "@/lib/types";
import type { MemberVote } from "@osaja/types";

interface PendingVote {
  voteId: string;
  optionId: string;
  label: string;
}

export default function VotingPage() {
  const [votes, setVotes] = useState<MemberVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingVote | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Record<string, unknown>[]>("/voting");
      setVotes((res.data ?? []).map((v) => mapVote(v as Record<string, unknown>)));
    } catch {
      setVotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectOption = (voteId: string, optionId: string, label: string) => {
    setPending({ voteId, optionId, label });
    setError("");
    setSuccess("");
  };

  const confirmVote = async () => {
    if (!pending) return;
    setSubmitting(pending.voteId);
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/voting/${pending.voteId}/submit`, {
        method: "POST",
        body: JSON.stringify({ option_id: pending.optionId }),
      });
      setSuccess("Your vote has been recorded and locked.");
      setPending(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit vote");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voting"
        description="Participate in community decisions. Each vote is locked after you confirm your choice."
      />

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

      {pending ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-900">Confirm your vote</p>
              <p className="mt-1 text-sm text-amber-800">
                You selected <span className="font-semibold">{pending.label}</span>. This cannot be changed after
                submission.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting !== null}
                  onClick={confirmVote}
                  className="rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Confirm vote"}
                </button>
                <button
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => setPending(null)}
                  className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <ListRowsSkeleton rows={3} variant="light" />
      ) : votes.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={Vote}
            title="No active votes"
            description="When the executive team opens a vote, you'll be able to cast your ballot here."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {votes.map((vote) => (
            <article key={vote.id} className="glass-card overflow-hidden">
              <div className="border-b border-slate-100 bg-gradient-to-r from-brand-navy/5 to-transparent px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy/60">{vote.voteType}</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{vote.title}</h3>
                    {vote.description ? <p className="mt-2 text-sm text-slate-600">{vote.description}</p> : null}
                  </div>
                  {vote.hasVoted ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Voted
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-gold/20 px-3 py-1 text-xs font-semibold text-brand-gold-dark">
                      Open
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Closes {formatDate(vote.closesAt)}
                  {vote.minimumContribution != null
                    ? ` · Min. contribution: ${formatCurrency(vote.minimumContribution)}`
                    : null}
                </p>
              </div>

              <div className="p-4 sm:p-6">
                {vote.hasVoted ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Lock className="h-4 w-4 text-slate-400" />
                    You selected:{" "}
                    <span className="font-semibold text-brand-navy">
                      {vote.options.find((o) => o.id === vote.votedOptionId)?.label ?? "—"}
                    </span>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {vote.options.map((opt) => {
                      const isSelected =
                        pending?.voteId === vote.id && pending.optionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={submitting === vote.id}
                          onClick={() => selectOption(vote.id, opt.id, opt.label)}
                          className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition disabled:opacity-50 ${
                            isSelected
                              ? "border-brand-navy bg-brand-navy/10 text-brand-navy ring-2 ring-brand-navy/20"
                              : "border-slate-200 bg-white text-slate-800 hover:border-brand-navy hover:bg-brand-navy/5"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
