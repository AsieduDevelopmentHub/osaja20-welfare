"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Campaign {
  id: string;
  name: string;
  message: string;
  recipient_count: number;
  status: string;
  estimated_units: number;
  scheduled_at: string | null;
  created_at: string | null;
  sandbox: boolean;
}

interface CampaignsResponse {
  items: Campaign[];
  total: number;
}

export default function ScheduledPage() {
  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<CampaignsResponse>("/sms/campaigns?status=scheduled&page_size=50")
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load scheduled SMS"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-gold">SMS Portal</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Scheduled SMS</h1>
          <p className="mt-1 text-sm text-slate-400">
            Campaigns accepted by Arkesel for future delivery (Ghana local time).
          </p>
        </div>
        <Link
          href="/compose"
          className="inline-flex items-center justify-center rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
        >
          Schedule new
        </Link>
      </header>

      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-brand-gold" />
          <p className="mt-4 text-sm font-semibold text-white">No scheduled campaigns</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data?.items.map((c) => (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">{c.name}</h2>
                <span className="rounded-full bg-brand-gold/20 px-2.5 py-0.5 text-xs text-brand-gold">
                  scheduled
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-300">{c.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                {c.recipient_count} recipients · {c.estimated_units} units
                {c.scheduled_at ? ` · fires ${new Date(c.scheduled_at).toLocaleString()}` : ""}
                {c.sandbox ? " · sandbox" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
