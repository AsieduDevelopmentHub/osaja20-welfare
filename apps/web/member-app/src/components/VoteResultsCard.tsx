"use client";

import { Trophy } from "lucide-react";

export interface VoteResultRow {
  option_id: string;
  label: string;
  count: number;
  percentage: number;
}

export interface PublishedVoteResult {
  vote_id: string;
  vote_title: string;
  total_votes: number;
  winner_label?: string | null;
  has_voted?: boolean;
  voted_option_label?: string;
  results: VoteResultRow[];
}

export function VoteResultsCard({ data, compact = false }: { data: PublishedVoteResult; compact?: boolean }) {
  const maxCount = Math.max(...data.results.map((r) => r.count), 1);

  return (
    <article className={compact ? "rounded-xl border border-slate-100 bg-slate-50/80 p-4" : "glass-card p-5 sm:p-6"}>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy/60">Results published</p>
        <h3 className={`font-bold text-slate-900 ${compact ? "text-base" : "text-lg"}`}>{data.vote_title}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {data.total_votes} vote{data.total_votes === 1 ? "" : "s"} cast
          {data.winner_label ? (
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-700">
              <Trophy className="h-3.5 w-3.5" />
              {data.winner_label}
            </span>
          ) : null}
        </p>
        {data.has_voted && data.voted_option_label ? (
          <p className="mt-2 text-sm text-brand-navy">
            Your vote: <span className="font-semibold">{data.voted_option_label}</span>
          </p>
        ) : null}
      </div>
      <ul className="space-y-3">
        {data.results.map((row) => {
          const width = data.total_votes > 0 ? (row.count / maxCount) * 100 : 0;
          return (
            <li key={row.option_id}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-slate-800">{row.label}</span>
                <span className="text-slate-500">
                  {row.count} ({row.percentage}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-navy" style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
