"use client";

import type { DuesPeriod, DuesSummary } from "@osaja/types";
import { formatCurrency } from "@osaja/utils";
import { CreditCard, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

interface PaymentConfig {
  paystackEnabled: boolean;
  paystackConfigured: boolean;
  title: string;
  note: string;
}

interface PayDuesPanelProps {
  dues: DuesSummary;
  payment: PaymentConfig;
  onPaymentStarted?: () => void;
}

function unpaidPeriods(periods: DuesPeriod[]) {
  return periods.filter((p) => p.status === "due" || p.status === "overdue");
}

export function PayDuesPanel({ dues, payment, onPaymentStarted }: PayDuesPanelProps) {
  const [loading, setLoading] = useState<"current" | "all" | null>(null);
  const [error, setError] = useState("");

  const unpaid = useMemo(() => unpaidPeriods(dues.periods), [dues.periods]);
  const currentUnpaid = unpaid.find(
    (p) => p.year === dues.currentMonth.year && p.month === dues.currentMonth.month
  );
  const totalArrears = unpaid.length * dues.monthlyAmount;

  if (!payment.paystackEnabled || !payment.paystackConfigured) {
    return null;
  }

  if (unpaid.length === 0) {
    return (
      <div className="glass-card border border-emerald-200 bg-emerald-50/50 p-5 sm:p-6">
        <p className="font-semibold text-emerald-800">You&apos;re all caught up</p>
        <p className="mt-1 text-sm text-emerald-700">All dues for this period are paid. Thank you!</p>
      </div>
    );
  }

  const pay = async (periods: { year: number; month: number }[], mode: "current" | "all") => {
    setLoading(mode);
    setError("");
    try {
      const res = await apiFetch<{ authorization_url?: string; reference?: string }>(
        "/payments/initialize",
        {
          method: "POST",
          body: JSON.stringify({ periods }),
        }
      );
      const url = res.data?.authorization_url;
      if (!url) throw new Error(res.message || "Could not start payment");
      onPaymentStarted?.();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be started");
      setLoading(null);
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-navy/5 to-transparent px-5 py-4 sm:px-6">
        <h3 className="font-semibold text-slate-900">{payment.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{payment.note}</p>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        {currentUnpaid ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() =>
              pay([{ year: currentUnpaid.year, month: currentUnpaid.month }], "current")
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3.5 text-sm font-semibold text-white hover:bg-brand-navy-dark disabled:opacity-60"
          >
            {loading === "current" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
            Pay {dues.currentMonth.label} — {formatCurrency(dues.monthlyAmount)}
          </button>
        ) : null}

        {unpaid.length > 1 || (unpaid.length === 1 && !currentUnpaid) ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() =>
              pay(
                unpaid.map((p) => ({ year: p.year, month: p.month })),
                "all"
              )
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-navy/20 bg-white px-4 py-3.5 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5 disabled:opacity-60"
          >
            {loading === "all" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
            Pay all {unpaid.length} month{unpaid.length === 1 ? "" : "s"} — {formatCurrency(totalArrears)}
          </button>
        ) : null}

        <p className="text-center text-xs text-slate-400">
          Secured by Paystack · Card, mobile money &amp; bank
        </p>
      </div>
    </div>
  );
}
