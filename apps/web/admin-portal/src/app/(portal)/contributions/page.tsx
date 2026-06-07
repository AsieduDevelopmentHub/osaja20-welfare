"use client";

import { env } from "@/lib/env";
import { formatCurrency } from "@osaja/utils";
import { Receipt, Search, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { mapMember } from "@/lib/types";
import type { Member } from "@osaja/types";

export default function ContributionsPage() {
  const now = new Date();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalFund, setTotalFund] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ total_contributions: number }>("/contributions/summary")
      .then((r) => setTotalFund(r.data?.total_contributions ?? 0))
      .catch(() => setTotalFund(0));
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setError("");
    try {
      const res = await apiFetch<Record<string, unknown>[]>(
        `/members/search?q=${encodeURIComponent(query.trim())}&limit=8`
      );
      setResults((res.data ?? []).map((m) => mapMember(m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }, [query]);

  const recordDues = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/contributions", {
        method: "POST",
        body: JSON.stringify({
          member_id: selected.id,
          amount: env.monthlyDuesAmount,
          type: "dues",
          reference: reference.trim() || `Dues ${periodMonth}/${periodYear}`,
          period_year: periodYear,
          period_month: periodMonth,
        }),
      });
      setMessage(`Recorded ${formatCurrency(env.monthlyDuesAmount)} dues for ${selected.fullName}`);
      setReference("");
      const summary = await apiFetch<{ total_contributions: number }>("/contributions/summary");
      setTotalFund(summary.data?.total_contributions ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record");
    } finally {
      setLoading(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i, 1).toLocaleString("en-GH", { month: "long" }),
  }));

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/20">
            <Wallet className="h-5 w-5 text-brand-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Contributions</h1>
            <p className="text-sm text-slate-400">
              Record monthly dues ({formatCurrency(env.monthlyDuesAmount)}/member)
              {totalFund != null ? ` · Fund total ${formatCurrency(totalFund)}` : ""}
            </p>
          </div>
        </div>
      </header>

      {message ? <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
          <h2 className="mb-4 font-semibold text-white">Find member</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
            className="flex gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, or member ID..."
                className="w-full rounded-xl border border-slate-600 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-brand-gold"
              />
            </div>
            <button type="submit" className="rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark">
              Search
            </button>
          </form>

          {results.length > 0 ? (
            <ul className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(m)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-white/5 ${
                      selected?.id === m.id ? "bg-brand-gold/10" : ""
                    }`}
                  >
                    <p className="font-medium text-white">{m.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {m.membershipId} · {m.email}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <Receipt className="h-5 w-5 text-brand-gold" />
            Record monthly dues
          </h2>

          {selected ? (
            <p className="mb-4 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
              Recording for <span className="font-semibold text-white">{selected.fullName}</span>
            </p>
          ) : (
            <p className="mb-4 text-sm text-slate-500">Select a member from search results.</p>
          )}

          <form onSubmit={recordDues} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Month</label>
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Year</label>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Amount (GHS)</label>
              <input
                readOnly
                value={env.monthlyDuesAmount}
                className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-300"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Payment reference</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="MoMo ref, receipt no., etc."
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={!selected || loading}
              className="w-full rounded-xl bg-brand-gold py-3 text-sm font-semibold text-brand-navy-dark disabled:opacity-40"
            >
              {loading ? "Recording..." : `Record ${formatCurrency(env.monthlyDuesAmount)} dues`}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
