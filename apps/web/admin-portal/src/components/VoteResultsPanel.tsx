"use client";

import { Trophy, X } from "lucide-react";
import type { VoteResultsData } from "@/lib/types";

export function VoteResultsPanel({
  data,
  onClose,
}: {
  data: VoteResultsData;
  onClose: () => void;
}) {
  const maxCount = Math.max(...data.results.map((r) => r.count), 1);

  return (
    <div className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-gold">Results</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{data.vote_title}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {data.total_votes} vote{data.total_votes === 1 ? "" : "s"} cast
            {data.winner_label ? (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <Trophy className="h-3.5 w-3.5" />
                  Leading: {data.winner_label}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close results"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <ul className="space-y-4">
        {data.results.map((row) => {
          const isWinner = row.option_id === data.winner_option_id && data.total_votes > 0;
          const width = data.total_votes > 0 ? (row.count / maxCount) * 100 : 0;
          return (
            <li key={row.option_id}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className={`font-medium ${isWinner ? "text-emerald-300" : "text-white"}`}>
                  {row.label || "Option"}
                </span>
                <span className="shrink-0 text-slate-400">
                  {row.count} ({row.percentage}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${isWinner ? "bg-emerald-500" : "bg-brand-gold"}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
