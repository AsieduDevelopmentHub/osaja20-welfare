"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Skeleton } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsEmptyState, SmsPageHeader, SmsStatusBadge } from "@/components/sms-ui";

interface Campaign {
  id: string;
  name: string;
  message: string;
  recipient_count: number;
  status: string;
  estimated_units: number;
  scheduled_at: string | null;
  created_at: string | null;
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
    <div className="space-y-5">
      <SmsPageHeader
        title="Scheduled SMS"
        description="Campaigns queued for future delivery."
        action={
          <Link
            href="/compose"
            className="inline-flex items-center justify-center rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
          >
            Schedule new
          </Link>
        }
      />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="dark" className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <SmsEmptyState
          icon={CalendarClock}
          title="No scheduled campaigns"
          description="Schedule a send from Compose when you need a future delivery."
          actionHref="/compose"
          actionLabel="Compose SMS"
        />
      ) : (
        <ul className="space-y-3">
          {data?.items.map((c) => (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">{c.name}</h2>
                <SmsStatusBadge status="scheduled" />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-300">{c.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                {c.recipient_count} recipients · {c.estimated_units} credits
                {c.scheduled_at ? ` · fires ${new Date(c.scheduled_at).toLocaleString()}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
