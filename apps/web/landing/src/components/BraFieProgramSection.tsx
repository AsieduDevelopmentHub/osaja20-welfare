"use client";

import { CalendarDays, Clock3, MapPin, Ticket } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { aos } from "@/lib/aos";

type TicketCategory = {
  id: string;
  name: string;
  description: string;
  price: string;
  admissions_per_ticket: number;
  inventory_remaining: number | null;
};

type TicketEvent = {
  title: string;
  description: string;
  venue: string;
  starts_at: string;
  categories: TicketCategory[];
};

function formatPrice(price: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(Number(price));
}

export function BraFieProgramSection() {
  const [event, setEvent] = useState<TicketEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchaserName, setPurchaserName] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [purchaserPhone, setPurchaserPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/tickets/events/bra-fie-night-2027")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Ticket availability is temporarily unavailable.");
        if (result.success && result.data && active) {
          setEvent(result.data);
          setSelectedCategory(result.data.categories[0]?.id ?? "");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load ticket availability.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () => event?.categories.find((category) => category.id === selectedCategory),
    [event?.categories, selectedCategory],
  );
  const total = selected ? Number(selected.price) * quantity : 0;

  async function beginCheckout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/v1/tickets/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: selected.id,
          quantity,
          purchaser_name: purchaserName,
          purchaser_email: purchaserEmail,
          purchaser_phone: purchaserPhone,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not start checkout.");
      const authorizationUrl = result.data?.authorization_url;
      if (!authorizationUrl) throw new Error("The payment provider did not return a checkout link.");
      window.location.assign(authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-[#16090c] px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-red-100/15 bg-[#260b10] shadow-2xl" {...aos("fade-right")}>
            <Image
              src="/programs/bra-fie-night-2027.jpeg"
              alt="Bra Fie Night 2027 event poster with dress code and ticket prices"
              width={1024}
              height={1536}
              priority
              sizes="(max-width: 1024px) 100vw, 550px"
              className="h-full max-h-[760px] w-full object-contain"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 pt-16 sm:p-7 sm:pt-20">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-200">OSAJA&apos;20 presents</p>
              <p className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">Bra Fie Night</p>
            </div>
          </div>

          <div {...aos("fade-left", { delay: 100 })}>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-300">The reunion night</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              One night.
              <span className="block text-amber-200">All our people.</span>
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-rose-100/75">
              Come home to the OSAJA&apos;20 family for a night of good food, familiar faces, music, and
              memories worth making.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <CalendarDays className="h-5 w-5 shrink-0 text-amber-200" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-rose-100/55">Date</p>
                  <p className="mt-0.5 text-sm font-semibold">Friday, 1 January 2027</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <Clock3 className="h-5 w-5 shrink-0 text-amber-200" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-rose-100/55">Doors / main event</p>
                  <p className="mt-0.5 text-sm font-semibold">4:00 PM / 5:00 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:col-span-2">
                <MapPin className="h-5 w-5 shrink-0 text-amber-200" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-rose-100/55">Venue</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {event?.venue ??
                      "Candix Royal Hotel, Amanfrom Sawmill Junction, opposite Seventh Day Adventist (SDA) School"}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-5 text-sm text-rose-100/70">
              <span className="font-semibold text-white">Dress code:</span> any dinner outfit with a touch of red.
            </p>

          </div>
        </div>

        <div className="mt-14 grid gap-8 rounded-[1.75rem] border border-red-100/15 bg-gradient-to-br from-[#300b12] to-[#1d0a0d] p-5 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
          <div>
            <div className="flex items-center gap-2 text-amber-200">
              <Ticket className="h-5 w-5" />
              <p className="text-xs font-bold uppercase tracking-[0.2em]">Reserve your place</p>
            </div>
            <h3 className="mt-3 font-display text-3xl font-semibold">Tickets</h3>
            <p className="mt-2 text-sm leading-relaxed text-rose-100/65">
              Double admission is one ticket and one QR code for two people. Come together or use the remaining
              admission when your guest arrives later.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {loading ? (
                <p className="text-sm text-rose-100/60">Checking ticket availability…</p>
              ) : event?.categories.length ? (
                event.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    aria-pressed={selectedCategory === category.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                      selectedCategory === category.id
                        ? "border-amber-200/70 bg-amber-200/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{category.name}</span>
                      <span className="mt-0.5 block text-xs text-rose-100/55">
                        {category.admissions_per_ticket} {category.admissions_per_ticket === 1 ? "guest" : "guests"}
                        {category.inventory_remaining !== null ? ` · ${category.inventory_remaining} left` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-amber-200">{formatPrice(category.price)}</span>
                  </button>
                ))
              ) : (
                <p className="text-sm leading-relaxed text-rose-100/60">
                  Ticket sales are not available right now. Please check back or contact the organizers.
                </p>
              )}
            </div>
          </div>

          <form onSubmit={beginCheckout} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
              <label className="text-sm font-medium text-rose-50">
                Number of tickets
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#16090c] px-3 py-3 text-white outline-none focus:border-amber-200"
                  disabled={!selected || submitting}
                >
                  {Array.from({ length: Math.min(10, selected?.inventory_remaining ?? 10) }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs text-rose-100/55">Total</p>
                <p className="mt-1 text-lg font-bold text-amber-200">{formatPrice(total.toFixed(2))}</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-rose-50">
              Purchaser name
              <input
                required
                autoComplete="name"
                value={purchaserName}
                onChange={(e) => setPurchaserName(e.target.value)}
                maxLength={200}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#16090c] px-3 py-3 text-white outline-none placeholder:text-rose-100/30 focus:border-amber-200"
                placeholder="Full name"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-rose-50">
                Email for your tickets
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={purchaserEmail}
                  onChange={(e) => setPurchaserEmail(e.target.value)}
                  maxLength={255}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#16090c] px-3 py-3 text-white outline-none placeholder:text-rose-100/30 focus:border-amber-200"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block text-sm font-medium text-rose-50">
                Phone number
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  value={purchaserPhone}
                  onChange={(e) => setPurchaserPhone(e.target.value)}
                  minLength={7}
                  maxLength={30}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#16090c] px-3 py-3 text-white outline-none placeholder:text-rose-100/30 focus:border-amber-200"
                  placeholder="+233…"
                />
              </label>
            </div>
            {error ? <p role="alert" className="rounded-xl border border-red-300/30 bg-red-950/50 p-3 text-sm text-red-100">{error}</p> : null}
            <button
              type="submit"
              disabled={!selected || loading || submitting || selected.inventory_remaining === 0}
              className="flex w-full items-center justify-center rounded-xl bg-amber-200 px-5 py-3.5 text-sm font-bold text-[#2a0a0f] transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Opening secure checkout…" : "Continue to secure checkout"}
            </button>
            <p className="text-center text-xs leading-relaxed text-rose-100/45">
              Your ticket is issued only after payment is confirmed by the payment provider.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
