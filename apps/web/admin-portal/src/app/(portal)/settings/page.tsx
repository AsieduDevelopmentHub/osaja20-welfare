"use client";

import { Loader2, Save, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { apiFetch } from "@/lib/api";
import type { PaymentSettings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<PaymentSettings>("/settings/payment")
      .then((r) => setSettings(r.data as PaymentSettings))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<PaymentSettings>("/settings/payment", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(res.data as PaymentSettings);
      setMessage("Payment settings saved. Members will see updated MoMo and bank details.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  if (!settings) {
    return <p className="text-red-300">{error || "Could not load settings"}</p>;
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Platform settings"
        description="Payment instructions shown to members on the Contributions page."
      />

      {message ? <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <form onSubmit={save} className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <Settings className="h-5 w-5 text-brand-gold" />
            Dues & general
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly dues (GHS)">
              <input
                type="number"
                min={1}
                step={0.01}
                value={settings.monthly_amount}
                onChange={(e) => update("monthly_amount", Number(e.target.value))}
                className="input-dark"
              />
            </Field>
            <Field label="Currency">
              <input value={settings.currency} onChange={(e) => update("currency", e.target.value)} className="input-dark" />
            </Field>
            <Field label="Payment section title" className="sm:col-span-2">
              <input value={settings.title} onChange={(e) => update("title", e.target.value)} className="input-dark" />
            </Field>
            <Field label="Footer note" className="sm:col-span-2">
              <textarea
                value={settings.note}
                onChange={(e) => update("note", e.target.value)}
                rows={2}
                className="input-dark"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Mobile Money</h2>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={settings.momo_enabled}
                onChange={(e) => update("momo_enabled", e.target.checked)}
              />
              Enabled
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label">
              <input value={settings.momo_label} onChange={(e) => update("momo_label", e.target.value)} className="input-dark" />
            </Field>
            <Field label="MoMo number">
              <input value={settings.momo_number} onChange={(e) => update("momo_number", e.target.value)} className="input-dark" />
            </Field>
            <Field label="Account name">
              <input
                value={settings.momo_account_name}
                onChange={(e) => update("momo_account_name", e.target.value)}
                className="input-dark"
              />
            </Field>
            <Field label="Instructions" className="sm:col-span-2">
              <textarea
                value={settings.momo_detail}
                onChange={(e) => update("momo_detail", e.target.value)}
                rows={2}
                className="input-dark"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Bank transfer</h2>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={settings.bank_enabled}
                onChange={(e) => update("bank_enabled", e.target.checked)}
              />
              Enabled
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name">
              <input value={settings.bank_name} onChange={(e) => update("bank_name", e.target.value)} className="input-dark" />
            </Field>
            <Field label="Account number">
              <input
                value={settings.bank_account_number}
                onChange={(e) => update("bank_account_number", e.target.value)}
                className="input-dark"
              />
            </Field>
            <Field label="Account name" className="sm:col-span-2">
              <input
                value={settings.bank_account_name}
                onChange={(e) => update("bank_account_name", e.target.value)}
                className="input-dark"
              />
            </Field>
            <Field label="Instructions" className="sm:col-span-2">
              <textarea
                value={settings.bank_detail}
                onChange={(e) => update("bank_detail", e.target.value)}
                rows={2}
                className="input-dark"
              />
            </Field>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold py-3 text-sm font-semibold text-brand-navy-dark disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "Saving..." : "Save payment settings"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}
