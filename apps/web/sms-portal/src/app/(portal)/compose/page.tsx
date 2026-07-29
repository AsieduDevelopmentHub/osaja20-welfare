"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  MessageSquarePlus,
  Send,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface RecipientGroup {
  id: string;
  label: string;
  description: string;
  count: number;
  total_members: number;
}

interface Estimate {
  recipient_count: number;
  invalid_phone_count: number;
  pages_per_message: number;
  estimated_units: number;
  character_count: number;
  sender_id: string;
  arkesel_configured: boolean;
  sandbox: boolean;
}

interface MemberOption {
  id: string;
  full_name: string;
  membership_id: string;
  phone_number: string;
  phone_normalized: string | null;
  status: string;
}

export default function ComposePage() {
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [group, setGroup] = useState("active");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [customMembers, setCustomMembers] = useState<MemberOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await apiFetch<RecipientGroup[]>("/sms/recipients/groups");
      setGroups(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipient groups");
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (group !== "custom") return;
    apiFetch<MemberOption[]>("/sms/recipients?group=active")
      .then((res) => setCustomMembers(res.data ?? []))
      .catch(() => setCustomMembers([]));
  }, [group]);

  const memberIds = useMemo(
    () => (group === "custom" ? selectedIds : []),
    [group, selectedIds]
  );

  useEffect(() => {
    if (!message.trim()) {
      setEstimate(null);
      return;
    }
    const handle = window.setTimeout(() => {
      setEstimating(true);
      apiFetch<Estimate>("/sms/estimate", {
        method: "POST",
        body: JSON.stringify({
          message,
          recipient_group: group,
          member_ids: memberIds,
        }),
      })
        .then((res) => setEstimate(res.data ?? null))
        .catch(() => setEstimate(null))
        .finally(() => setEstimating(false));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [message, group, memberIds]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!message.trim()) {
      setError("Message is required");
      return;
    }
    if (group === "custom" && selectedIds.length === 0) {
      setError("Select at least one recipient");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch<{
        campaign: { id: string; status: string };
        submitted: number;
        invalid: number;
        estimated_units: number;
      }>("/sms/compose", {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
          name: name.trim() || null,
          recipient_group: group,
          member_ids: memberIds,
          schedule_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
          sandbox,
        }),
      });
      setSuccess(
        `Campaign ${res.data?.campaign.status ?? "submitted"} — ${res.data?.submitted ?? 0} recipient(s), ~${res.data?.estimated_units ?? 0} SMS unit(s).`
      );
      setMessage("");
      setName("");
      setScheduleAt("");
      setSelectedIds([]);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand-gold">SMS Portal</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Compose SMS</h1>
        <p className="mt-1 text-sm text-slate-400">
          Write a message, choose recipients, preview cost, then send or schedule via Arkesel.
        </p>
      </header>

      <form onSubmit={handleSend} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</p>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <label htmlFor="campaign-name" className="mb-1.5 block text-sm font-medium text-slate-300">
            Campaign name (optional)
          </label>
          <input
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="July contribution reminder"
            className="input-dark outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-300">
            Message
          </label>
          <textarea
            id="message"
            required
            rows={5}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="OSAJA'20 Welfare: ..."
            className="input-dark resize-y outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          />
          <p className="mt-2 text-xs text-slate-500">{message.length}/1000 characters</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
            <Users className="h-4 w-4 text-brand-gold" />
            Recipients
          </div>
          {loadingGroups ? (
            <p className="text-sm text-slate-400">Loading groups…</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {groups.map((g) => (
                <label
                  key={g.id}
                  className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
                    group === g.id
                      ? "border-brand-gold bg-brand-gold/10"
                      : "border-white/10 bg-slate-900/40 hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="group"
                    value={g.id}
                    checked={group === g.id}
                    onChange={() => setGroup(g.id)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-semibold text-white">{g.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{g.description}</span>
                  <span className="mt-1 block text-xs text-brand-gold">{g.count} with valid phone</span>
                </label>
              ))}
            </div>
          )}

          {group === "custom" ? (
            <div className="mt-4 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/10 p-2">
              {customMembers.length === 0 ? (
                <p className="p-2 text-sm text-slate-400">No active members found.</p>
              ) : (
                customMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">{m.full_name}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {m.membership_id} · {m.phone_normalized || m.phone_number || "no phone"}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <label htmlFor="schedule" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
              <CalendarClock className="h-4 w-4 text-brand-gold" />
              Schedule (optional)
            </label>
            <input
              id="schedule"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="input-dark outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            />
            <p className="mt-2 text-xs text-slate-500">Leave empty to send immediately.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <p className="mb-3 text-sm font-medium text-slate-300">Cost estimate</p>
            {estimating ? (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
              </p>
            ) : estimate ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">Recipients</dt>
                  <dd className="font-semibold text-white">{estimate.recipient_count}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Pages</dt>
                  <dd className="font-semibold text-white">{estimate.pages_per_message}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">SMS units</dt>
                  <dd className="font-semibold text-brand-gold">{estimate.estimated_units}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Sender</dt>
                  <dd className="font-semibold text-white">{estimate.sender_id}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-400">Start typing to estimate cost.</p>
            )}
            <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
              Sandbox (no carrier delivery / no billing)
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold py-3 font-semibold text-brand-navy-dark transition hover:bg-brand-gold-light disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : scheduleAt ? <CalendarClock className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          {sending ? "Submitting…" : scheduleAt ? "Schedule SMS" : "Send SMS"}
        </button>
      </form>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Delivery is handled by Arkesel. Ensure your sender ID is approved in the Arkesel dashboard.
      </p>
    </div>
  );
}
