"use client";

import { ContributionCardSkeleton, ListRowsSkeleton } from "@osaja/ui";
import { formatCurrency } from "@osaja/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useState } from "react";
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
import { queryKeys } from "@/lib/query-keys";
import { mapContributionList, mapDuesSummary } from "@/lib/types";

export default function ContributionsPage() {
  const { member } = useAuth();
  const [page, setPage] = useState(1);

  const duesQuery = useQuery({
    queryKey: queryKeys.dues,
    enabled: Boolean(member),
    queryFn: async () => {
      const res = await apiFetch<Record<string, unknown>>("/members/me/dues");
      return mapDuesSummary(res.data as Record<string, unknown>);
    },
  });

  const paymentQuery = useQuery({
    queryKey: queryKeys.paymentSettings,
    enabled: Boolean(member),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const payRes = await apiFetch<Record<string, unknown>>("/settings/payment");
      const raw = (payRes.data || {}) as Record<string, unknown>;
      return {
        paystackEnabled: Boolean(raw.paystack_enabled ?? true),
        paystackConfigured: Boolean(raw.paystack_configured),
        manualEnabled: Boolean(raw.manual_payment_enabled),
        title: String(raw.title ?? env.payment.title),
        note: String(raw.note ?? env.payment.note),
      };
    },
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.contributions(page),
    enabled: Boolean(member),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const histRes = await apiFetch<Record<string, unknown>>(
        `/members/me/contributions?page=${page}&page_size=20`
      );
      return mapContributionList(histRes.data as Record<string, unknown>);
    },
  });

  const dues = duesQuery.data ?? null;
  const paymentConfig = paymentQuery.data ?? {
    paystackEnabled: true,
    paystackConfigured: false,
    manualEnabled: false,
    title: env.payment.title,
    note: env.payment.note,
  };
  const history = historyQuery.data?.items ?? [];
  const total = historyQuery.data?.total ?? 0;
  const totalPages = historyQuery.data?.total_pages ?? 1;
  const bootLoading = Boolean(member) && duesQuery.isLoading && !duesQuery.data;
  const error = duesQuery.error || paymentQuery.error || historyQuery.error;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Contributions"
        description={`Monthly welfare dues of ${formatCurrency(dues?.monthlyAmount ?? env.monthlyDuesAmount)} keep our fund running for every member.`}
      />

      {error ? (
        <Alert tone="error">
          {error instanceof Error ? error.message : "Could not load contributions"}
        </Alert>
      ) : null}

      {bootLoading ? (
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

          {historyQuery.isLoading && !historyQuery.data ? (
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
                  onPageChange={setPage}
                />
              }
            />
          )}
        </>
      ) : null}
    </div>
  );
}
