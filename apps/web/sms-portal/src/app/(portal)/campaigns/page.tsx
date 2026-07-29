"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Campaign {
  id: string;
  name: string;
  message: string;
  recipient_group: string;
  recipient_count: number;
  status: string;
  estimated_units: number;
  sender_id: string;
  sandbox: boolean;
  created_at: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
}

interface CampaignsResponse {
  items: Campaign[];
  total: number;
}

export default function CampaignsPage() {
  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<CampaignsResponse>("/sms/campaigns?page=1&page_size=50")
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-gold">SMS Portal</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">Bulk SMS campaigns and delivery summaries.</p>
        </div>
        <Link
          href="/compose"
          className="inline-flex items-center justify-center rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
        >
          New campaign
        </Link>
      </header>

      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
          <MessagesSquare className="mx-auto h-10 w-10 text-brand-gold" />
          <p className="mt-4 text-sm font-semibold text-white">No campaigns yet</p>
          <Link href="/compose" className="mt-4 inline-block text-sm font-semibold text-brand-gold hover:underline">
            Compose your first SMS
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {data?.items.map((c) => (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">{c.name}</h2>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs capitalize text-slate-300">
                  {c.status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-300">{c.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                {c.recipient_count} recipients · {c.estimated_units} units · {c.recipient_group}
                {c.sandbox ? " · sandbox" : ""}
                {c.created_at ? ` · ${new Date(c.created_at).toLocaleString()}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
