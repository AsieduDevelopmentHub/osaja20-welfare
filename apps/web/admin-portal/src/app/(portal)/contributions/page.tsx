"use client";

import type { Member } from "@osaja/types";
import { formatCurrency } from "@osaja/utils";
import { Receipt, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { ContributionTrackingPanel } from "@/components/ContributionTrackingPanel";
import { MemberSearchInput } from "@/components/MemberSearchInput";
import { AdminPanel, Alert, FilterPills, FormSection } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { PaymentSettings } from "@/lib/types";

type Tab = "record" | "ledger";

export default function ContributionsPage() {
  const now = new Date();
  const [tab, setTab] = useState<Tab>("record");
  const [selected, setSelected] = useState<Member | null>(null);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalFund, setTotalFund] = useState<number | null>(null);
  const [monthlyAmount, setMonthlyAmount] = useState(30);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ total_contributions: number }>("/contributions/summary")
      .then((r) => setTotalFund(r.data?.total_contributions ?? 0))
      .catch(() => setTotalFund(0));
    apiFetch<PaymentSettings>("/settings/payment")
      .then((r) => {
        if (r.data?.monthly_amount) setMonthlyAmount(r.data.monthly_amount);
      })
      .catch(() => {});
  }, []);

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
          amount: monthlyAmount,
          type: "dues",
          reference: reference.trim() || `Dues ${periodMonth}/${periodYear}`,
          period_year: periodYear,
          period_month: periodMonth,
        }),
      });
      setMessage(`Recorded ${formatCurrency(monthlyAmount)} dues for ${selected.fullName}`);
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
      <AdminHeader
        icon={Wallet}
        title="Contributions"
        description={
          totalFund != null
            ? `Record monthly dues (${formatCurrency(monthlyAmount)}/member) · Fund total ${formatCurrency(totalFund)}`
            : `Record monthly dues (${formatCurrency(monthlyAmount)}/member)`
        }
      />

      {message ? (
        <Alert tone="success" onDismiss={() => setMessage("")}>
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      <FilterPills<Tab>
        size="md"
        options={[
          { value: "record", label: "Record dues" },
          { value: "ledger", label: "Tracking" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "record" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminPanel>
            <FormSection
              step={1}
              title="Find member"
              description="Search by name, email, or membership ID."
            >
              <MemberSearchInput
                selected={selected}
                onSelect={setSelected}
                onClear={() => setSelected(null)}
              />
            </FormSection>
          </AdminPanel>

          <AdminPanel>
            <FormSection
              step={2}
              title="Record monthly dues"
              description={`Fixed amount of ${formatCurrency(monthlyAmount)} from payment settings.`}
            >
              <form onSubmit={recordDues} className="space-y-4">
                {selected ? (
                  <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300 ring-1 ring-white/10">
                    Recording for <span className="font-semibold text-white">{selected.fullName}</span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">Select a member first.</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Month</label>
                    <select
                      value={periodMonth}
                      onChange={(e) => setPeriodMonth(Number(e.target.value))}
                      className="input-dark"
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
                      className="input-dark"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Amount (GHS)</label>
                  <input readOnly value={monthlyAmount} className="input-dark bg-slate-800 text-slate-300" />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Payment reference</label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="MoMo ref, receipt no., etc."
                    className="input-dark"
                  />
                </div>

                <button type="submit" disabled={!selected || loading} className="btn-gold w-full py-3">
                  <Receipt className="h-4 w-4" />
                  {loading ? "Recording..." : `Record ${formatCurrency(monthlyAmount)} dues`}
                </button>
              </form>
            </FormSection>
          </AdminPanel>
        </div>
      ) : (
        <ContributionTrackingPanel onError={setError} />
      )}
    </div>
  );
}
