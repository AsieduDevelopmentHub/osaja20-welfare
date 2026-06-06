import { PAYMENT_INSTRUCTIONS } from "@osaja/config";
import { Copy, Smartphone, Building2 } from "lucide-react";
import { useState } from "react";

export function PaymentInstructions({ membershipId }: { membershipId: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const momo = PAYMENT_INSTRUCTIONS.methods.find((m) => m.id === "momo");
  const bank = PAYMENT_INSTRUCTIONS.methods.find((m) => m.id === "bank");

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-navy/5 to-transparent px-5 py-4 sm:px-6">
        <h3 className="font-semibold text-slate-900">{PAYMENT_INSTRUCTIONS.title}</h3>
        <p className="mt-1 text-sm text-slate-500">
          Use your Member ID <span className="font-mono font-semibold text-brand-navy">{membershipId}</span> as payment reference.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {momo ? (
          <div className="flex gap-4 px-5 py-4 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <Smartphone className="h-5 w-5 text-amber-600" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{momo.label}</p>
              <p className="mt-1 text-sm text-slate-500">{momo.detail}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-semibold text-brand-navy">
                  {momo.number}
                </span>
                <button
                  type="button"
                  onClick={() => copy(momo.number, "momo")}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === "momo" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">{momo.name}</p>
            </div>
          </div>
        ) : null}

        {bank ? (
          <div className="flex gap-4 px-5 py-4 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-navy/5">
              <Building2 className="h-5 w-5 text-brand-navy" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{bank.label}</p>
              <p className="mt-1 text-sm text-slate-500">{bank.detail}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-500">Account</dt>
                  <dd className="font-medium text-slate-800">{bank.accountName}</dd>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="text-slate-500">Number</dt>
                  <dd className="font-mono font-semibold text-brand-navy">{bank.accountNumber}</dd>
                  <button
                    type="button"
                    onClick={() => copy(bank.accountNumber, "bank")}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === "bank" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-500">Bank</dt>
                  <dd className="text-slate-800">{bank.bank}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}
      </div>

      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">{PAYMENT_INSTRUCTIONS.note}</p>
    </div>
  );
}
