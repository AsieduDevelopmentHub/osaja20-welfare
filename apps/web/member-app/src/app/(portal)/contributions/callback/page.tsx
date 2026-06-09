"use client";

import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";

function CallbackContent() {
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setMessage("No payment reference found.");
      return;
    }

    apiFetch<Record<string, unknown>>(`/payments/verify/${encodeURIComponent(reference)}`)
      .then((res) => {
        if (res.success) {
          setStatus("success");
          setMessage(res.message || "Your dues have been recorded.");
        } else {
          setStatus("error");
          setMessage(res.message || res.error || "Payment could not be verified.");
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Payment verification failed.");
      });
  }, [reference]);

  return (
    <div className="mx-auto max-w-md space-y-6 py-8 text-center">
      {status === "loading" ? (
        <>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-navy" />
          <p className="text-slate-600">Confirming your payment…</p>
        </>
      ) : null}

      {status === "success" ? (
        <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="text-lg font-semibold text-slate-900">Payment successful</p>
          <p className="text-sm text-slate-600">{message}</p>
        </>
      ) : null}

      {status === "error" ? (
        <>
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="text-lg font-semibold text-slate-900">Payment not confirmed</p>
          <p className="text-sm text-red-700">{message}</p>
        </>
      ) : null}

      {status !== "loading" ? (
        <Link
          href="/contributions"
          className="inline-flex rounded-xl bg-brand-navy px-6 py-3 text-sm font-semibold text-white hover:bg-brand-navy-dark"
        >
          Back to contributions
        </Link>
      ) : null}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Payment" description="Processing your Paystack payment." />
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-navy" />
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
