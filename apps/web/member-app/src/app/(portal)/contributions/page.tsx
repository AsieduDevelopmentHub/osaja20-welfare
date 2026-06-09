"use client";

import { ContributionCardSkeleton, ListRowsSkeleton } from "@osaja/ui";
import { env } from "@/lib/env";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { ContributionHistory } from "@/components/ContributionHistory";
import { DuesStatusBanner } from "@/components/DuesStatusBanner";
import { MonthDuesGrid } from "@/components/MonthDuesGrid";
import { PayDuesPanel } from "@/components/PayDuesPanel";
import { PaymentInstructions } from "@/components/PaymentInstructions";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { mapContributionList, mapDuesSummary } from "@/lib/types";
import type { Contribution, DuesSummary } from "@osaja/types";
import { formatCurrency } from "@osaja/utils";

export default function ContributionsPage() {
  const { member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dues, setDues] = useState<DuesSummary | null>(null);
  const [history, setHistory] = useState<Contribution[]>([]);
  const [paymentConfig, setPaymentConfig] = useState({
    paystackEnabled: true,
    paystackConfigured: false,
    manualEnabled: false,
    title: env.payment.title,
    note: env.payment.note,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    setError("");

    Promise.all([
      apiFetch<Record<string, unknown>>("/members/me/dues"),
      apiFetch<Record<string, unknown>>("/members/me/contributions?page=1&page_size=20"),
      apiFetch<Record<string, unknown>>("/settings/payment"),
    ])
      .then(([duesRes, histRes, payRes]) => {
        setDues(mapDuesSummary(duesRes.data as Record<string, unknown>));
        setHistory(mapContributionList(histRes.data as Record<string, unknown>).items);
        const raw = (payRes.data || {}) as Record<string, unknown>;
        setPaymentConfig({
          paystackEnabled: Boolean(raw.paystack_enabled ?? true),
          paystackConfigured: Boolean(raw.paystack_configured),
          manualEnabled: Boolean(raw.manual_payment_enabled),
          title: String(raw.title ?? env.payment.title),
          note: String(raw.note ?? env.payment.note),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load contributions"))
      .finally(() => setLoading(false));
  }, [member]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contributions"
        description={`Monthly welfare dues of ${formatCurrency(dues?.monthlyAmount ?? env.monthlyDuesAmount)} keep our fund running for every member.`}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <>
          <ContributionCardSkeleton variant="light" />
          <ListRowsSkeleton rows={4} variant="light" />
        </>
      ) : dues ? (
        <>
          <DuesStatusBanner dues={dues} />

          {dues.arrearsCount > 0 ? (
            <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-4 sm:px-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-800">
                  You have {dues.arrearsCount} unpaid month{dues.arrearsCount === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-sm text-red-700">
                  Total outstanding: {formatCurrency(dues.totalOwed)}.
                  {paymentConfig.paystackEnabled && paymentConfig.paystackConfigured
                    ? " Pay online below to clear your arrears instantly."
                    : " Please pay via the instructions below."}
                </p>
              </div>
            </div>
          ) : null}

          <MonthDuesGrid periods={dues.periods} />

          <PayDuesPanel dues={dues} payment={paymentConfig} />

          {member && paymentConfig.manualEnabled ? (
            <PaymentInstructions membershipId={member.membershipId} />
          ) : null}

          <ContributionHistory items={history} />
        </>
      ) : null}
    </div>
  );
}
