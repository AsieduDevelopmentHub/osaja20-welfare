"use client";

import { formatCurrency } from "@osaja/utils";
import { LayoutGrid, Receipt, Table } from "lucide-react";
import { useEffect, useState } from "react";

export interface LedgerItem {
  id: string;
  date: string;
  amount: number;
  type: string;
  typeLabel?: string;
  reference?: string;
  period?: string;
  subtitle?: string;
}

export type LedgerViewMode = "cards" | "table";
export type LedgerVariant = "light" | "dark";

const STORAGE_KEY = "osaja-ledger-view";

const TYPE_LABELS: Record<string, string> = {
  dues: "Monthly dues",
  donation: "Donation",
  welfare: "Welfare",
  other: "Other",
};

function labelFor(item: LedgerItem) {
  return item.typeLabel ?? TYPE_LABELS[item.type] ?? item.type;
}

export function ContributionLedger({
  items,
  variant = "light",
  title = "Payment history",
}: {
  items: LedgerItem[];
  variant?: LedgerVariant;
  title?: string;
}) {
  const [view, setView] = useState<LedgerViewMode>("cards");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "cards" || saved === "table") setView(saved);
  }, []);

  const setMode = (mode: LedgerViewMode) => {
    setView(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  const isDark = variant === "dark";
  const wrap = isDark
    ? "rounded-2xl border border-white/10 bg-brand-navy/60 overflow-hidden"
    : "glass-card overflow-hidden";
  const headerBorder = isDark ? "border-white/10" : "border-slate-100";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-400" : "text-slate-500";

  if (items.length === 0) {
    return (
      <div className={wrap}>
        <div className={`border-b ${headerBorder} px-5 py-4 sm:px-6`}>
          <h3 className={`font-semibold ${textPrimary}`}>{title}</h3>
        </div>
        <p className={`px-5 py-8 text-sm ${textMuted} sm:px-6`}>No records yet.</p>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b ${headerBorder} px-5 py-4 sm:px-6`}>
        <h3 className={`font-semibold ${textPrimary}`}>{title}</h3>
        <div className={`flex rounded-lg p-0.5 ${isDark ? "bg-white/10" : "bg-slate-100"}`}>
          <button
            type="button"
            onClick={() => setMode("cards")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
              view === "cards"
                ? isDark
                  ? "bg-brand-gold text-brand-navy-dark"
                  : "bg-white text-brand-navy shadow-sm"
                : isDark
                  ? "text-slate-300"
                  : "text-slate-600"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setMode("table")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
              view === "table"
                ? isDark
                  ? "bg-brand-gold text-brand-navy-dark"
                  : "bg-white text-brand-navy shadow-sm"
                : isDark
                  ? "text-slate-300"
                  : "text-slate-600"
            }`}
          >
            <Table className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <ul className={isDark ? "divide-y divide-white/5" : "divide-y divide-slate-100"}>
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-4 py-4 sm:px-6">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isDark ? "bg-emerald-500/20" : "bg-emerald-50"
                }`}
              >
                <Receipt className={`h-5 w-5 ${isDark ? "text-emerald-300" : "text-emerald-600"}`} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`font-medium ${textPrimary}`}>{labelFor(c)}</p>
                  {c.period ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.period}
                    </span>
                  ) : null}
                </div>
                {c.subtitle ? <p className={`mt-0.5 text-sm ${textMuted}`}>{c.subtitle}</p> : null}
                <p className={`mt-0.5 text-sm ${textMuted}`}>{c.date}</p>
                {c.reference ? (
                  <p className={`mt-0.5 truncate font-mono text-xs ${textMuted}`}>Ref: {c.reference}</p>
                ) : null}
              </div>
              <p
                className={`shrink-0 text-base font-bold tabular-nums ${
                  isDark ? "text-brand-gold" : "text-emerald-700"
                }`}
              >
                +{formatCurrency(c.amount)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className={`border-b text-xs ${isDark ? "border-white/10 text-slate-400" : "border-slate-100 text-slate-500"}`}>
                <th className="px-4 py-3 font-medium sm:px-6">Date</th>
                {items.some((i) => i.subtitle) ? (
                  <th className="px-4 py-3 font-medium sm:px-6">Member</th>
                ) : null}
                <th className="px-4 py-3 font-medium sm:px-6">Type</th>
                <th className="px-4 py-3 font-medium sm:px-6">Period</th>
                <th className="px-4 py-3 font-medium sm:px-6">Reference</th>
                <th className="px-4 py-3 font-medium sm:px-6">Amount</th>
              </tr>
            </thead>
            <tbody className={isDark ? "divide-y divide-white/5" : "divide-y divide-slate-100"}>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className={`px-4 py-3 sm:px-6 ${textMuted}`}>{c.date}</td>
                  {items.some((i) => i.subtitle) ? (
                    <td className={`px-4 py-3 sm:px-6 ${textPrimary}`}>{c.subtitle ?? "—"}</td>
                  ) : null}
                  <td className={`px-4 py-3 capitalize sm:px-6 ${textPrimary}`}>{labelFor(c)}</td>
                  <td className={`px-4 py-3 sm:px-6 ${textMuted}`}>{c.period ?? "—"}</td>
                  <td className={`px-4 py-3 sm:px-6 ${textMuted}`}>{c.reference || "—"}</td>
                  <td
                    className={`px-4 py-3 font-semibold tabular-nums sm:px-6 ${
                      isDark ? "text-brand-gold" : "text-emerald-700"
                    }`}
                  >
                    +{formatCurrency(c.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
