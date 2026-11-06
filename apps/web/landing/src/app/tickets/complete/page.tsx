"use client";

import { ArrowLeft, CheckCircle2, Copy, Download, LoaderCircle, Printer, Ticket, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type IssuedTicket = {
  ticket_number: string | null;
  category: string;
  admission_entitlement: number;
  admissions_used: number;
  admissions_remaining: number;
  status: string;
  qr_svg_base64: string;
};

type ManualOrder = {
  reference: string;
  status: string;
  payment_method: "momo" | "bank";
  amount: string;
  currency: string;
  expires_at: string;
  review_note: string | null;
  payment_details: {
    label?: string;
    detail?: string;
    number?: string;
    account_name?: string;
    bank_name?: string;
    account_number?: string;
  } | null;
};

function rememberOrderEmail(reference: string, email: string) {
  try {
    sessionStorage.setItem(`ticket-order-email:${reference}`, email.trim());
  } catch {
    return;
  }
}

function validMomoNumber(number: string) {
  const digits = number.replace(/\D/g, "");
  return /^\+?[0-9 ()-]+$/.test(number) && digits.length >= 7 && digits.length <= 15;
}

export default function TicketPaymentCompletePage() {
  const [reference, setReference] = useState("");
  const [lookupReference, setLookupReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"checking" | "paid" | "pending" | "error" | "tracking" | "manual">("checking");
  const [email, setEmail] = useState("");
  const [manualOrder, setManualOrder] = useState<ManualOrder | null>(null);
  const [transactionReference, setTransactionReference] = useState("");
  const [senderName, setSenderName] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<IssuedTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentReference = params.get("reference");
    if (params.get("manual") === "1" || !paymentReference) {
      setLookupReference(paymentReference ?? "");
      let savedEmail: string | null = null;
      try {
        savedEmail = paymentReference ? sessionStorage.getItem(`ticket-order-email:${paymentReference}`) : null;
      } catch {
        savedEmail = null;
      }
      if (paymentReference && savedEmail) {
        setEmail(savedEmail);
        void loadManualOrder(paymentReference, savedEmail);
      } else {
        setPaymentStatus("tracking");
      }
      return;
    }
    let active = true;
    setReference(paymentReference);
    fetch(`/api/v1/tickets/orders/${encodeURIComponent(paymentReference)}/verify`, { method: "POST" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Payment could not be verified.");
        if (!active) return;
        if (result.data?.status === "paid") setPaymentStatus("paid");
        else if (result.data?.status === "refund_required") {
          setPaymentStatus("error");
          setError("This payment arrived after its reservation expired. Please contact the organizers before attempting another purchase.");
        } else setPaymentStatus("pending");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setPaymentStatus("error");
        setError(cause instanceof Error ? cause.message : "Payment could not be verified.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function loadManualOrder(orderReference: string, purchaserEmail: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/tickets/orders/${encodeURIComponent(orderReference)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaser_email: purchaserEmail.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Order could not be found.");
      const order = result.data as ManualOrder;
      setReference(order.reference);
      setLookupReference(order.reference);
      setManualOrder(order);
      setTransactionReference((current) => current || order.reference);
      rememberOrderEmail(order.reference, purchaserEmail);
      setPaymentStatus(order.status === "paid" ? "paid" : "manual");
    } catch (cause) {
      setPaymentStatus("tracking");
      setError(cause instanceof Error ? cause.message : "Order could not be found.");
    } finally {
      setBusy(false);
    }
  }

  async function submitManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/tickets/orders/${encodeURIComponent(reference)}/submit-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaser_email: email.trim(), transaction_reference: transactionReference.trim(), sender_name: senderName.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Payment could not be submitted.");
      await loadManualOrder(reference, email);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopyMessage("Reference copied.");
    } catch {
      setCopyMessage("Could not copy. Select the reference above to copy it.");
    }
  }

  async function downloadTicket(ticket: IssuedTicket, index: number) {
    try {
      const image = new window.Image();
      image.src = `data:image/svg+xml;base64,${ticket.qr_svg_base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 768;
      canvas.height = 768;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image download is unavailable.");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `ticket-${ticket.ticket_number ?? index + 1}.png`;
      link.click();
    } catch {
      setError("The QR image could not be downloaded. Try printing the ticket instead.");
    }
  }

  async function retrieveTickets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingTickets(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/tickets/orders/${encodeURIComponent(reference)}/retrieve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchaser_email: email }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Tickets could not be retrieved.");
      setTickets(result.data?.tickets ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tickets could not be retrieved.");
    } finally {
      setLoadingTickets(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#16090c] px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/programs/bra-fie-night-2027" className="inline-flex items-center gap-2 text-sm text-rose-100/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to Bra Fie Night
        </Link>

        <section className="mt-8 rounded-[1.75rem] border border-red-100/15 bg-gradient-to-br from-[#300b12] to-[#1d0a0d] p-6 sm:p-10">
          {paymentStatus === "tracking" ? (
            <form onSubmit={(event) => { event.preventDefault(); void loadManualOrder(lookupReference.trim(), email); }} className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">Find your ticket order</h1>
              <label className="block text-sm font-medium text-rose-50">Order reference
                <input required value={lookupReference} onChange={(event) => setLookupReference(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#16090c] px-4 py-3 text-white outline-none focus:border-amber-200" />
              </label>
              <label className="block text-sm font-medium text-rose-50">Purchaser email
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#16090c] px-4 py-3 text-white outline-none focus:border-amber-200" />
              </label>
              <button disabled={busy} className="rounded-xl bg-amber-200 px-5 py-3 font-semibold text-[#2a0a0f] disabled:opacity-60">{busy ? "Checking…" : "Find order"}</button>
            </form>
          ) : null}

          {paymentStatus === "manual" && manualOrder ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase text-amber-200">{manualOrder.payment_details?.label ?? "Manual payment"}</p>
                <h1 className="mt-2 font-display text-3xl font-semibold">{manualOrder.status === "awaiting_payment" ? "Complete your payment" : "Payment status"}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-rose-100/80">
                  <p className="break-all">Order reference: <strong className="text-white">{reference}</strong></p>
                  <button type="button" onClick={() => void copyReference()} title="Copy order reference" aria-label="Copy order reference" className="rounded border border-white/20 p-2 text-white hover:bg-white/10"><Copy className="h-4 w-4" /></button>
                </div>
                {copyMessage ? <p role="status" className="mt-1 text-xs text-rose-100/70">{copyMessage}</p> : null}
                <p className="mt-2 text-sm text-rose-100/70">Save this reference and your purchaser email to check your order later.</p>
              </div>
              {manualOrder.status === "awaiting_payment" ? (
                <>
                  <div className="space-y-2 border-y border-white/10 py-4 text-sm text-rose-100/80">
                    <p>Amount: <strong className="text-white">{new Intl.NumberFormat("en-GH", { style: "currency", currency: manualOrder.currency }).format(Number(manualOrder.amount))}</strong></p>
                    {manualOrder.payment_details?.number ? <p>MoMo number: <strong className="text-white">{manualOrder.payment_details.number}</strong></p> : null}
                    {manualOrder.payment_details?.bank_name ? <p>Bank: <strong className="text-white">{manualOrder.payment_details.bank_name}</strong></p> : null}
                    {manualOrder.payment_details?.account_number ? <p>Account number: <strong className="text-white">{manualOrder.payment_details.account_number}</strong></p> : null}
                    {manualOrder.payment_details?.account_name ? <p>Account name: <strong className="text-white">{manualOrder.payment_details.account_name}</strong></p> : null}
                    <p>Copy your order reference into the reference field when making the transfer. Reservation expires {new Date(manualOrder.expires_at).toLocaleString()}.</p>
                  </div>
                  {manualOrder.payment_method === "momo" && !validMomoNumber(manualOrder.payment_details?.number ?? "") ? (
                    <p role="alert" className="text-sm text-red-200">The payment number is not configured. Do not send a payment; contact the organizers.</p>
                  ) : null}
                  <form onSubmit={submitManualPayment} className="space-y-4">
                    <label className="block text-sm font-medium text-rose-50">Payment reference used for transfer
                      <input required minLength={4} maxLength={100} pattern="[A-Za-z0-9._\x2f\x2d]+" value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#16090c] px-4 py-3 text-white outline-none focus:border-amber-200" />
                    </label>
                    <label className="block text-sm font-medium text-rose-50">{manualOrder.payment_method === "momo" ? "Name on sender's MoMo account" : "Name on sender's bank account"}
                      <input required minLength={2} maxLength={200} value={senderName} onChange={(event) => setSenderName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#16090c] px-4 py-3 text-white outline-none focus:border-amber-200" />
                    </label>
                    <button disabled={busy || (manualOrder.payment_method === "momo" && !validMomoNumber(manualOrder.payment_details?.number ?? ""))} className="rounded-xl bg-amber-200 px-5 py-3 font-semibold text-[#2a0a0f] disabled:opacity-60">{busy ? "Submitting…" : "Submit payment for review"}</button>
                  </form>
                </>
              ) : (
                <div role="status" className="text-sm leading-relaxed text-rose-100/80">
                  {manualOrder.status === "payment_submitted" ? "Your payment reference is awaiting admin review. No ticket has been issued yet." : null}
                  {manualOrder.status === "rejected" ? `Payment was not approved. ${manualOrder.review_note ?? "Contact the organizers."}` : null}
                  {manualOrder.status === "expired" ? "This reservation has expired. Please start a new order." : null}
                  {!['payment_submitted', 'rejected', 'expired'].includes(manualOrder.status) ? `Order status: ${manualOrder.status.replaceAll('_', ' ')}` : null}
                </div>
              )}
              <button type="button" onClick={() => void loadManualOrder(reference, email)} disabled={busy} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-60">Check status</button>
            </div>
          ) : null}

          {paymentStatus === "checking" ? (
            <div className="flex items-center gap-3">
              <LoaderCircle className="h-6 w-6 animate-spin text-amber-200" />
              <div>
                <h1 className="text-xl font-semibold">Verifying your payment</h1>
                <p className="mt-1 text-sm text-rose-100/65">Tickets are not issued until the payment provider confirms your payment.</p>
              </div>
            </div>
          ) : null}

          {paymentStatus === "paid" ? (
            <>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Payment confirmed</p>
                  <h1 className="mt-1 font-display text-3xl font-semibold">Your night is booked.</h1>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-rose-100/70">
                Enter the purchaser email to retrieve your digital tickets. Keep each QR code ready at the gate.
                A Double ticket uses one QR code for both admissions, including when guests arrive separately.
              </p>
              <form onSubmit={retrieveTickets} className="mt-6 flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="purchaser-email">Purchaser email</label>
                <input
                  id="purchaser-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#16090c] px-4 py-3 text-white outline-none placeholder:text-rose-100/35 focus:border-amber-200"
                  placeholder="Purchaser email"
                />
                <button
                  type="submit"
                  disabled={loadingTickets}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-200 px-5 py-3 font-semibold text-[#2a0a0f] hover:bg-amber-100 disabled:opacity-60"
                >
                  <Ticket className="h-4 w-4" />
                  {loadingTickets ? "Retrieving…" : "Retrieve tickets"}
                </button>
              </form>

              {tickets.length ? (
                <div className="ticket-print-area mt-7">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 print:hidden"
                  >
                    <Printer className="h-4 w-4" />
                    Print tickets
                  </button>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {tickets.map((ticket, index) => (
                      <article key={`${ticket.category}-${index}`} className="rounded-2xl bg-white p-5 text-[#260b10]">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#8c1d2c]">Bra Fie Night 2027 · 1 Jan 2027</p>
                        <h2 className="mt-1 text-xl font-bold">{ticket.category}</h2>
                        {ticket.ticket_number ? <p className="mt-1 font-mono text-sm text-slate-700">Ticket: {ticket.ticket_number}</p> : null}
                        <p className="mt-1 text-sm text-slate-600">
                          {ticket.admission_entitlement} {ticket.admission_entitlement === 1 ? "admission" : "admissions"}
                        </p>
                        <Image
                          src={`data:image/svg+xml;base64,${ticket.qr_svg_base64}`}
                          alt={`QR code for ${ticket.category} ticket`}
                          width={192}
                          height={192}
                          unoptimized
                          className="mx-auto mt-4 aspect-square w-48 max-w-full"
                        />
                        <p className="mt-2 text-center text-xs text-slate-500">Show this code at the entrance</p>
                        <button type="button" onClick={() => void downloadTicket(ticket, index)} className="mt-4 inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 print:hidden"><Download className="h-4 w-4" />Download QR</button>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {paymentStatus === "pending" ? (
            <div className="flex items-start gap-3">
              <LoaderCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-200" />
              <div>
                <h1 className="text-xl font-semibold">Payment is still pending</h1>
                <p className="mt-2 text-sm leading-relaxed text-rose-100/70">
                  No ticket has been issued yet. Wait for your provider confirmation and refresh this page to verify again.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                >
                  Check payment again
                </button>
              </div>
            </div>
          ) : null}

          {paymentStatus === "error" ? (
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-300" />
              <div>
                <h1 className="text-xl font-semibold">We couldn&apos;t confirm this payment</h1>
                <p className="mt-2 text-sm leading-relaxed text-rose-100/70">{error}</p>
              </div>
            </div>
          ) : null}

          {error && (paymentStatus === "paid" || paymentStatus === "tracking" || paymentStatus === "manual") ? (
            <p role="alert" className="mt-4 rounded-xl border border-red-300/30 bg-red-950/50 p-3 text-sm text-red-100">
              {error}
            </p>
          ) : null}
          {reference && paymentStatus !== "manual" ? <p className="mt-6 break-all border-t border-white/10 pt-4 text-xs text-rose-100/40">Order reference: {reference}</p> : null}
        </section>
      </div>
    </main>
  );
}
