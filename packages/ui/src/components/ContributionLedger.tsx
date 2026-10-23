"use client";

import { formatCurrency } from "@osaja/utils";
import { LayoutGrid, Receipt, Table } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

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
  description,
  footer,
  toolbar,
  emptyMessage = "No records yet.",
}: {
  items: LedgerItem[];
  variant?: LedgerVariant;
  title?: string;
  description?: string;
  footer?: ReactNode;
  toolbar?: ReactNode;
  emptyMessage?: string;
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
  const showMember = items.some((i) => i.subtitle);

  const viewToggle = (
    <div className={`flex rounded-lg p-0.5 ${isDark ? "bg-white/10" : "bg-slate-100"}`}>
      <button
        type="button"
        onClick={() => setMode("cards")}
        aria-pressed={view === "cards"}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
          view === "cards"
            ? isDark
              ? "bg-brand-gold text-brand-navy-dark"
              : "bg-white text-brand-navy shadow-sm"
            : isDark
              ? "text-slate-300 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Cards
      </button>
      <button
        type="button"
        onClick={() => setMode("table")}
        aria-pressed={view === "table"}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
          view === "table"
            ? isDark
              ? "bg-brand-gold text-brand-navy-dark"
              : "bg-white text-brand-navy shadow-sm"
            : isDark
              ? "text-slate-300 hover:text-white"
              : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <Table className="h-3.5 w-3.5" />
        Table
      </button>
    </div>
  );

  const cards = (
    <ul className={isDark ? "divide-y divide-white/5" : "divide-y divide-slate-100"}>
      {items.map((c) => (
        <li key={c.id} className="flex items-start gap-3 px-4 py-4 sm:items-center sm:gap-4 sm:px-6">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:mt-0 ${
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
            {c.subtitle ? <p className={`mt-0.5 truncate text-sm ${textMuted}`}>{c.subtitle}</p> : null}
            <p className={`mt-0.5 text-sm ${textMuted}`}>{c.date}</p>
            {c.reference ? (
              <p className={`mt-0.5 truncate font-mono text-xs ${textMuted}`}>Ref: {c.reference}</p>
            ) : null}
          </div>
          <p
            className={`shrink-0 text-sm font-bold tabular-nums sm:text-base ${
              isDark ? "text-brand-gold" : "text-emerald-700"
            }`}
          >
            +{formatCurrency(c.amount)}
          </p>
        </li>
      ))}
    </ul>
  );

  const table = (
    <div className="-mx-0 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 z-10">
          <tr
            className={`border-b text-xs uppercase tracking-wide ${
              isDark ? "border-white/10 bg-brand-navy/90 text-slate-400" : "border-slate-100 bg-white/95 text-slate-500"
            }`}
          >
            <th className="whitespace-nowrap px-4 py-3 font-medium sm:px-6">Date</th>
            {showMember ? <th className="whitespace-nowrap px-4 py-3 font-medium sm:px-6">Member</th> : null}
            <th className="whitespace-nowrap px-4 py-3 font-medium sm:px-6">Type</th>
            <th className="whitespace-nowrap px-4 py-3 font-medium sm:px-6">Period</th>
            <th className="whitespace-nowrap px-4 py-3 font-medium sm:px-6">Reference</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-medium sm:px-6">Amount</th>
          </tr>
        </thead>
        <tbody className={isDark ? "divide-y divide-white/5" : "divide-y divide-slate-100"}>
          {items.map((c) => (
            <tr
              key={c.id}
              className={isDark ? "transition hover:bg-white/[0.03]" : "transition hover:bg-slate-50/80"}
            >
              <td className={`whitespace-nowrap px-4 py-3 sm:px-6 ${textMuted}`}>{c.date}</td>
              {showMember ? (
                <td className={`max-w-[220px] truncate px-4 py-3 sm:px-6 ${textPrimary}`} title={c.subtitle}>
                  {c.subtitle ?? "—"}
                </td>
              ) : null}
              <td className={`whitespace-nowrap px-4 py-3 sm:px-6 ${textPrimary}`}>{labelFor(c)}</td>
              <td className={`whitespace-nowrap px-4 py-3 sm:px-6 ${textMuted}`}>{c.period ?? "—"}</td>
              <td className={`max-w-[180px] truncate px-4 py-3 font-mono text-xs sm:px-6 ${textMuted}`} title={c.reference}>
                {c.reference || "—"}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums sm:px-6 ${
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
  );

  return (
    <div className={wrap}>
      <div className={`border-b ${headerBorder} px-4 py-4 sm:px-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`font-semibold ${textPrimary}`}>{title}</h3>
            {description ? <p className={`mt-0.5 text-sm ${textMuted}`}>{description}</p> : null}
          </div>
          {items.length > 0 ? <div className="hidden sm:block">{viewToggle}</div> : null}
        </div>
        {toolbar ? <div className="mt-4">{toolbar}</div> : null}
        {items.length > 0 ? <div className="mt-3 sm:hidden">{viewToggle}</div> : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center sm:px-6">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              isDark ? "bg-white/5" : "bg-slate-100"
            }`}
          >
            <Receipt className={`h-6 w-6 ${textMuted}`} strokeWidth={1.5} />
          </div>
          <p className={`text-sm ${textMuted}`}>{emptyMessage}</p>
        </div>
      ) : (
        <>
          {/* Mobile: always cards for readability */}
          <div className="md:hidden">{cards}</div>
          {/* Desktop: respect user preference */}
          <div className="hidden md:block">{view === "cards" ? cards : table}</div>
        </>
      )}

      {footer ? (
        <div className={`border-t ${headerBorder} px-4 py-3 sm:px-6`}>{footer}</div>
      ) : null}
    </div>
  );
}
