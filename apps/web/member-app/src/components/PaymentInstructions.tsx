"use client";

import { Copy, Smartphone, Building2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { env } from "@/lib/env";

interface PaymentConfig {
  title: string;
  note: string;
  momo: {
    enabled: boolean;
    label: string;
    detail: string;
    number: string;
    accountName: string;
  };
  bank: {
    enabled: boolean;
    label: string;
    detail: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}

function configFromEnv(): PaymentConfig {
  return {
    title: env.payment.title,
    note: env.payment.note,
    momo: {
      enabled: env.payment.momo.enabled,
      label: env.payment.momo.label,
      detail: env.payment.momo.detail,
      number: env.payment.momo.number,
      accountName: env.payment.momo.accountName,
    },
    bank: {
      enabled: env.payment.bank.enabled,
      label: env.payment.bank.label,
      detail: env.payment.bank.detail,
      bankName: env.payment.bank.bankName,
      accountName: env.payment.bank.accountName,
      accountNumber: env.payment.bank.accountNumber,
    },
  };
}

function configFromApi(raw: Record<string, unknown>): PaymentConfig {
  return {
    title: String(raw.title ?? env.payment.title),
    note: String(raw.note ?? env.payment.note),
    momo: {
      enabled: Boolean(raw.momo_enabled ?? env.payment.momo.enabled),
      label: String(raw.momo_label ?? env.payment.momo.label),
      detail: String(raw.momo_detail ?? env.payment.momo.detail),
      number: String(raw.momo_number ?? env.payment.momo.number),
      accountName: String(raw.momo_account_name ?? env.payment.momo.accountName),
    },
    bank: {
      enabled: Boolean(raw.bank_enabled ?? env.payment.bank.enabled),
      label: String(raw.bank_label ?? env.payment.bank.label),
      detail: String(raw.bank_detail ?? env.payment.bank.detail),
      bankName: String(raw.bank_name ?? env.payment.bank.bankName),
      accountName: String(raw.bank_account_name ?? env.payment.bank.accountName),
      accountNumber: String(raw.bank_account_number ?? env.payment.bank.accountNumber),
    },
  };
}

export function PaymentInstructions({ membershipId }: { membershipId: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentConfig>(configFromEnv);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Record<string, unknown>>("/settings/payment")
      .then((res) => {
        if (res.data) setPayment(configFromApi(res.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-navy/5 to-transparent px-5 py-4 sm:px-6">
        <h3 className="font-semibold text-slate-900">{payment.title}</h3>
        <p className="mt-1 text-sm text-slate-500">
          Use your Member ID <span className="font-mono font-semibold text-brand-navy">{membershipId}</span> as payment reference.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {payment.momo.enabled ? (
          <div className="flex gap-4 px-5 py-4 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <Smartphone className="h-5 w-5 text-amber-600" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{payment.momo.label}</p>
              <p className="mt-1 text-sm text-slate-500">{payment.momo.detail}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold text-brand-navy">
                  {payment.momo.number}
                </span>
                <button
                  type="button"
                  onClick={() => copy(payment.momo.number, "momo")}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === "momo" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">{payment.momo.accountName}</p>
            </div>
          </div>
        ) : null}

        {payment.bank.enabled ? (
          <div className="flex gap-4 px-5 py-4 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-navy/5">
              <Building2 className="h-5 w-5 text-brand-navy" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{payment.bank.label}</p>
              <p className="mt-1 text-sm text-slate-500">{payment.bank.detail}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-500">Account</dt>
                  <dd className="font-medium text-slate-800">{payment.bank.accountName}</dd>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="text-slate-500">Number</dt>
                  <dd className="font-mono font-semibold text-brand-navy">{payment.bank.accountNumber}</dd>
                  <button
                    type="button"
                    onClick={() => copy(payment.bank.accountNumber, "bank")}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === "bank" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500">Bank</dt>
                  <dd className="text-slate-800">{payment.bank.bankName}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}
      </div>

      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">{payment.note}</p>
    </div>
  );
}
