import type { Contribution } from "@osaja/types";
import { formatCurrency, formatDate, periodLabel } from "@osaja/utils";
import { Receipt } from "lucide-react";
import { EmptyState } from "./EmptyState";

const TYPE_LABELS: Record<Contribution["type"], string> = {
  dues: "Monthly dues",
  donation: "Donation",
  welfare: "Welfare",
  other: "Other",
};

export function ContributionHistory({ items }: { items: Contribution[] }) {
  if (items.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={Receipt}
          title="No payments recorded yet"
          description="Once the executive team records your payment, it will appear here with date, amount, and reference."
        />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="font-semibold text-slate-900">Payment history</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-4 px-4 py-4 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <Receipt className="h-5 w-5 text-emerald-600" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{TYPE_LABELS[c.type] ?? c.type}</p>
                {c.periodYear && c.periodMonth ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {periodLabel(c.periodYear, c.periodMonth)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{formatDate(c.createdAt)}</p>
              {c.reference ? (
                <p className="mt-0.5 truncate font-mono text-xs text-slate-400">Ref: {c.reference}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-base font-bold tabular-nums text-emerald-700">+{formatCurrency(c.amount)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
