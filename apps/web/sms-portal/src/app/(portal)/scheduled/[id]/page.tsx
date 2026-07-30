"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Loader2, Save, XCircle } from "lucide-react";
import { Skeleton } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsPageHeader, SmsStatusBadge } from "@/components/sms-ui";

interface CampaignDetail {
  id: string;
  name: string;
  message: string;
  recipient_count: number;
  status: string;
  estimated_units: number;
  sender_id: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  schedule_state?: string;
  seconds_until?: number;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Due now";
  const s = Math.floor(totalSeconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function ScheduledDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = String(params.id || "");

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<CampaignDetail>(`/sms/campaigns/${campaignId}`);
      const data = res.data;
      if (!data) throw new Error("Campaign not found");
      setCampaign(data);
      setName(data.name);
      setMessage(data.message);
      setScheduleAt(data.scheduled_at ? toLocalInput(data.scheduled_at) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaign");
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const secondsUntil = useMemo(() => {
    if (!campaign?.scheduled_at || campaign.status !== "scheduled") return null;
    return Math.floor((new Date(campaign.scheduled_at).getTime() - nowTick) / 1000);
  }, [campaign, nowTick]);

  const scheduleLabel = useMemo(() => {
    if (!campaign) return "";
    if (campaign.schedule_state === "cancelled" || campaign.status === "cancelled") return "cancelled";
    if (campaign.schedule_state === "sent" || ["sent", "partial", "completed"].includes(campaign.status))
      return "sent";
    if (campaign.schedule_state === "failed" || campaign.status === "failed") return "failed";
    if (secondsUntil != null && secondsUntil <= 0) return "due";
    if (campaign.status === "scheduled") return "upcoming";
    return campaign.status;
  }, [campaign, secondsUntil]);

  const canEdit = campaign?.status === "scheduled" && secondsUntil != null && secondsUntil > 0;

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch<CampaignDetail>(`/sms/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim() || null,
          message: message.trim(),
          schedule_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
        }),
      });
      setCampaign(res.data ?? null);
      if (res.data) {
        setName(res.data.name);
        setMessage(res.data.message);
        setScheduleAt(res.data.scheduled_at ? toLocalInput(res.data.scheduled_at) : "");
      }
      setSuccess("Schedule updated — changes apply before send");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update campaign");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = async () => {
    if (!campaign || campaign.status !== "scheduled") return;
    if (!window.confirm("Cancel this scheduled SMS? It will not be sent.")) return;
    setCancelling(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch<CampaignDetail>(`/sms/campaigns/${campaignId}/cancel`, {
        method: "POST",
      });
      setCampaign(res.data ?? null);
      setSuccess("Campaign cancelled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel campaign");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="dark" className="h-8 w-56" />
        <Skeleton variant="dark" className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <SmsAlert variant="error">{error || "Campaign not found"}</SmsAlert>
        <Link href="/scheduled" className="text-sm font-semibold text-brand-gold hover:underline">
          Back to scheduled
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SmsPageHeader
        title={campaign.name}
        description="Scheduled delivery detail — edit or cancel before the send time."
        action={
          <button
            type="button"
            onClick={() => router.push("/scheduled")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
            All scheduled
          </button>
        }
      />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}
      {success ? <SmsAlert variant="success">{success}</SmsAlert> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-500">Schedule status</p>
          <div className="mt-2">
            <SmsStatusBadge status={scheduleLabel} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-500">Countdown</p>
          <p className="mt-2 text-lg font-semibold text-white">
            {campaign.status === "scheduled" && secondsUntil != null
              ? formatCountdown(secondsUntil)
              : campaign.sent_at
                ? `Sent ${new Date(campaign.sent_at).toLocaleString()}`
                : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-500">Recipients · credits</p>
          <p className="mt-2 text-lg font-semibold text-brand-gold">
            {campaign.recipient_count} · {campaign.estimated_units}
          </p>
        </div>
      </section>

      <dl className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm sm:p-5">
        <div className="flex justify-between gap-3 border-b border-white/5 py-2">
          <dt className="text-slate-500">Sender ID</dt>
          <dd className="text-right text-slate-200">{campaign.sender_id}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-white/5 py-2">
          <dt className="text-slate-500">Fires at</dt>
          <dd className="text-right text-slate-200">
            {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-slate-500">Created</dt>
          <dd className="text-right text-slate-200">
            {campaign.created_at ? new Date(campaign.created_at).toLocaleString() : "—"}
          </dd>
        </div>
      </dl>

      {canEdit ? (
        <form onSubmit={onSave} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarClock className="h-4 w-4 text-brand-gold" />
            Change before sending
          </h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            className="input-dark outline-none focus:border-brand-gold"
          />
          <textarea
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input-dark resize-y outline-none focus:border-brand-gold"
          />
          <label className="block text-sm text-slate-300">
            New schedule time
            <input
              type="datetime-local"
              required
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="input-dark mt-1.5 outline-none focus:border-brand-gold"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancel send
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Message</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{campaign.message}</p>
          {campaign.status === "scheduled" && secondsUntil != null && secondsUntil <= 0 ? (
            <p className="text-xs text-amber-300">
              Scheduled time reached — editing is locked. Refresh shortly for delivery status, or cancel if
              the worker has not picked it up yet.
            </p>
          ) : null}
          {campaign.status === "scheduled" ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancel send
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
