"use client";

import { ContributionCardSkeleton, ListRowsSkeleton } from "@osaja/ui";
import { formatCurrency } from "@osaja/utils";
import { Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ContributionHistory } from "@/components/ContributionHistory";
import { DuesStatusBanner } from "@/components/DuesStatusBanner";
import { MonthDuesGrid } from "@/components/MonthDuesGrid";
import { PayDuesPanel } from "@/components/PayDuesPanel";
import { PaymentInstructions } from "@/components/PaymentInstructions";
import { PageHeader } from "@/components/PageHeader";
import { Alert, PaginationBar } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { env } from "@/lib/env";
import { mapContributionList, mapDuesSummary } from "@/lib/types";
import type { Contribution, DuesSummary } from "@osaja/types";

export default function ContributionsPage() {
  const { member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dues, setDues] = useState<DuesSummary | null>(null);
  const [history, setHistory] = useState<Contribution[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({
    paystackEnabled: true,
    paystackConfigured: false,
    manualEnabled: false,
    title: env.payment.title,
    note: env.payment.note,
  });
  const [error, setError] = useState("");

  const loadHistory = useCallback(async (pageNum: number) => {
    setHistoryLoading(true);
    try {
      const histRes = await apiFetch<Record<string, unknown>>(
        `/members/me/contributions?page=${pageNum}&page_size=20`
      );
      const mapped = mapContributionList(histRes.data as Record<string, unknown>);
      setHistory(mapped.items);
      setTotal(mapped.total);
      setTotalPages(mapped.total_pages);
      setPage(mapped.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load payment history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

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
        const mapped = mapContributionList(histRes.data as Record<string, unknown>);
        setHistory(mapped.items);
        setTotal(mapped.total);
        setTotalPages(mapped.total_pages);
        setPage(mapped.page);
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
        icon={Wallet}
        title="Contributions"
        description={`Monthly welfare dues of ${formatCurrency(dues?.monthlyAmount ?? env.monthlyDuesAmount)} keep our fund running for every member.`}
      />

      {error ? (
        <Alert tone="error" onDismiss={() => setError("")}>
          {error}
        </Alert>
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
            <Alert tone="warning">
              <p className="font-semibold">
                You have {dues.arrearsCount} unpaid month{dues.arrearsCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1">
                Total outstanding: {formatCurrency(dues.totalOwed)}.
                {paymentConfig.paystackEnabled && paymentConfig.paystackConfigured
                  ? " Pay online below to clear your arrears instantly."
                  : " Please pay via the instructions below."}
              </p>
            </Alert>
          ) : null}

          <MonthDuesGrid periods={dues.periods} />

          <PayDuesPanel dues={dues} payment={paymentConfig} />

          {member && paymentConfig.manualEnabled ? (
            <PaymentInstructions membershipId={member.membershipId} />
          ) : null}

          {historyLoading ? (
            <ListRowsSkeleton rows={4} variant="light" />
          ) : (
            <ContributionHistory
              items={history}
              description={total > 0 ? `${total} recorded payment${total === 1 ? "" : "s"}` : undefined}
              footer={
                <PaginationBar
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  label="payment"
                  onPageChange={(p) => loadHistory(p)}
                />
              }
            />
          )}
        </>
      ) : null}
    </div>
  );
}
