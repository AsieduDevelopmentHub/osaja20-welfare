"use client";

import { formatCurrency } from "@osaja/utils";
import { TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function ContributionsPage() {
  const { member } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!member) return;
    setError("");
    apiFetch<{ balance: number }>(`/members/${member.id}/balance`)
      .then((r) => setBalance(r.data?.balance ?? 0))
      .catch((err) => {
        setBalance(0);
        setError(err instanceof Error ? err.message : "Could not load balance");
      });
  }, [member]);

  return (
    <div className="space-y-6">
      <PageHeader title="Contributions" description="Track your welfare fund payments and running balance." />

      <div className="glass-card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-navy/5 to-brand-gold/5 px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <Wallet className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current balance</p>
                <p className="mt-1 break-words text-2xl font-bold tabular-nums leading-tight text-brand-navy sm:text-3xl">
                  {balance === null ? "—" : formatCurrency(balance)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-100 sm:self-center">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              GHS welfare fund
            </div>
          </div>
        </div>

        <div className="px-5 py-4 sm:px-6">
          {error ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>
          ) : (
            <p className="text-sm text-slate-500">
              Payment history will appear here once contributions are recorded by the executive team.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
