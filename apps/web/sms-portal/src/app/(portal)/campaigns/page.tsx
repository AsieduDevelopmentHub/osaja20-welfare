"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Skeleton } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsEmptyState, SmsPageHeader, SmsStatusBadge } from "@/components/sms-ui";

interface Campaign {
  id: string;
  name: string;
  message: string;
  recipient_group: string;
  recipient_count: number;
  status: string;
  estimated_units: number;
  sender_id: string;
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
  const [status, setStatus] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", page_size: "50" });
    if (status) params.set("status", status);
    apiFetch<CampaignsResponse>(`/sms/campaigns?${params}`)
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="space-y-5">
      <SmsPageHeader
        title="Campaigns"
        description="Bulk SMS campaigns and delivery summaries."
        action={
          <Link
            href="/compose"
            className="inline-flex items-center justify-center rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
          >
            New campaign
          </Link>
        }
      />

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="input-dark outline-none focus:border-brand-gold sm:max-w-xs"
      >
        <option value="">All statuses</option>
        <option value="scheduled">Scheduled</option>
        <option value="sending">Sending</option>
        <option value="sent">Sent</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="dark" className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <SmsEmptyState
          icon={MessagesSquare}
          title="No campaigns yet"
          description="Compose your first SMS to create a campaign."
          actionHref="/compose"
          actionLabel="Compose SMS"
        />
      ) : (
        <ul className="space-y-3">
          {data?.items.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">{c.name}</h2>
                <SmsStatusBadge status={c.status} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-300">{c.message}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span>{c.recipient_count} recipients</span>
                <span>{c.estimated_units} credits</span>
                <span className="capitalize">{c.recipient_group.replace(/_/g, " ")}</span>
                {c.created_at ? <span>{new Date(c.created_at).toLocaleString()}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
