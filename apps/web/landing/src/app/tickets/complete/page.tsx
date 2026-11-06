"use client";

import { ArrowLeft, CheckCircle2, LoaderCircle, Printer, Ticket, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type IssuedTicket = {
  category: string;
  admission_entitlement: number;
  admissions_used: number;
  admissions_remaining: number;
  status: string;
  qr_svg_base64: string;
};

export default function TicketPaymentCompletePage() {
  const [reference, setReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"checking" | "paid" | "pending" | "error">("checking");
  const [email, setEmail] = useState("");
  const [tickets, setTickets] = useState<IssuedTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentReference = new URLSearchParams(window.location.search).get("reference");
    if (!paymentReference) {
      setError("A payment reference was not provided. Check your confirmation email or contact the organizers.");
      setPaymentStatus("error");
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

          {error && paymentStatus === "paid" ? (
            <p role="alert" className="mt-4 rounded-xl border border-red-300/30 bg-red-950/50 p-3 text-sm text-red-100">
              {error}
            </p>
          ) : null}
          <p className="mt-6 break-all border-t border-white/10 pt-4 text-xs text-rose-100/40">
            Order reference: {reference || "Unavailable"}
          </p>
        </section>
      </div>
    </main>
  );
}
