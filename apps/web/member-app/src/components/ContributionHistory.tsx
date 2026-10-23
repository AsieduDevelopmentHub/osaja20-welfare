import type { Contribution } from "@osaja/types";
import { ContributionLedger, type LedgerItem } from "@osaja/ui";
import { formatDate, periodLabel } from "@osaja/utils";
import { Receipt } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export function ContributionHistory({
  items,
  footer,
  description,
}: {
  items: Contribution[];
  footer?: ReactNode;
  description?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={Receipt}
          title="No payments recorded yet"
          description="Once a payment is recorded, it will appear here with date, amount, and reference."
        />
      </div>
    );
  }

  const ledgerItems: LedgerItem[] = items.map((c) => ({
    id: c.id,
    date: formatDate(c.createdAt),
    amount: c.amount,
    type: c.type,
    reference: c.reference,
    period: c.periodYear && c.periodMonth ? periodLabel(c.periodYear, c.periodMonth) : undefined,
  }));

  return (
    <ContributionLedger
      items={ledgerItems}
      variant="light"
      title="Payment history"
      description={description}
      footer={footer}
    />
  );
}
