"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { analyzeSmsSegments } from "@osaja/utils";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Send,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  SmsAlert,
  SmsPageHeader,
  SmsPhonePreview,
  SmsStepper,
  SmsStickyActions,
} from "@/components/sms-ui";

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
  encoding?: string;
  sender_id: string;
  arkesel_configured: boolean;
}

interface MemberOption {
  id: string;
  full_name: string;
  membership_id: string;
  phone_number: string;
  phone_normalized: string | null;
  status: string;
}

interface Template {
  id: string;
  name: string;
  body: string;
  category: string;
}

const STEPS = [
  { id: "message", label: "Message" },
  { id: "recipients", label: "Recipients" },
  { id: "review", label: "Review & send" },
];

function splitPhones(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function ComposeWizard() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [group, setGroup] = useState(searchParams.get("group") || "active");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [manualPhones, setManualPhones] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [customMembers, setCustomMembers] = useState<MemberOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const showManualPhones = group === "pending" || group === "custom";
  const segment = useMemo(() => analyzeSmsSegments(message), [message]);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const [groupsRes, templatesRes] = await Promise.all([
        apiFetch<RecipientGroup[]>("/sms/recipients/groups"),
        apiFetch<Template[]>("/sms/templates"),
      ]);
      setGroups(groupsRes.data ?? []);
      setTemplates(templatesRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load compose data");
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    const preset = searchParams.get("group");
    if (preset) setGroup(preset);
  }, [searchParams]);

  useEffect(() => {
    if (group !== "custom") {
      setCustomMembers([]);
      return;
    }
    apiFetch<MemberOption[]>("/sms/recipients?group=active")
      .then((res) => setCustomMembers(res.data ?? []))
      .catch(() => setCustomMembers([]));
  }, [group]);

  const memberIds = useMemo(
    () => (group === "custom" ? selectedIds : []),
    [group, selectedIds]
  );

  const phones = useMemo(
    () => (showManualPhones ? splitPhones(manualPhones) : []),
    [showManualPhones, manualPhones]
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
          phones,
        }),
      })
        .then((res) => setEstimate(res.data ?? null))
        .catch(() => setEstimate(null))
        .finally(() => setEstimating(false));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [message, group, memberIds, phones]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return customMembers;
    return customMembers.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.membership_id.toLowerCase().includes(q) ||
        (m.phone_number || "").includes(q)
    );
  }, [customMembers, memberQuery]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setMessage(tpl.body);
      if (!name.trim()) setName(tpl.name);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canNextFromMessage = message.trim().length > 0;

  const goNext = () => {
    setError("");
    if (step === 0 && !canNextFromMessage) {
      setError("Write a message (or pick a template) before continuing");
      return;
    }
    if (step === 1) {
      if (group === "custom" && selectedIds.length === 0 && phones.length === 0) {
        setError("Select at least one member or paste phone numbers");
        return;
      }
      if (group === "pending" && phones.length === 0) {
        setError("Paste at least one contact — members yet to join are not in the database");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSend = async () => {
    setError("");
    setSuccess("");
    if (!message.trim()) {
      setError("Message is required");
      return;
    }
    if (group === "custom" && selectedIds.length === 0 && phones.length === 0) {
      setError("Select at least one member or paste phone numbers");
      return;
    }
    if (group === "pending" && phones.length === 0) {
      setError("Paste at least one valid contact for members yet to join (055… / +233… / 233…)");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch<{
        campaign: { id: string; status: string };
        submitted: number;
        invalid: number;
        estimated_units: number;
        skipped_invalid_inputs?: string[];
      }>("/sms/compose", {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
          name: name.trim() || null,
          recipient_group: group,
          member_ids: memberIds,
          phones,
          schedule_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
          sandbox: false,
        }),
      });
      const skipped = res.data?.skipped_invalid_inputs?.length
        ? ` Skipped invalid: ${res.data.skipped_invalid_inputs.join(", ")}.`
        : "";
      setSuccess(
        `Campaign ${res.data?.campaign.status ?? "submitted"} — ${res.data?.submitted ?? 0} recipient(s), ~${res.data?.estimated_units ?? 0} SMS credit(s).${skipped}`
      );
      setMessage("");
      setName("");
      setScheduleAt("");
      setSelectedIds([]);
      setManualPhones("");
      setTemplateId("");
      setStep(0);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const selectedGroup = groups.find((g) => g.id === group);

  return (
    <div className="space-y-5 pb-28 lg:pb-6">
      <SmsPageHeader
        title="Compose SMS"
        description="Three steps: write, choose recipients, then review cost and send."
      />

      <SmsStepper steps={STEPS} current={step} />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}
      {success ? <SmsAlert variant="success">{success}</SmsAlert> : null}

      {step === 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(220px,280px)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <label htmlFor="campaign-name" className="mb-1.5 block text-sm font-medium text-slate-300">
                Campaign name (optional)
              </label>
              <input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly contribution reminder"
                className="input-dark outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                <FileText className="h-4 w-4 text-brand-gold" />
                Template
              </div>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="input-dark outline-none focus:border-brand-gold"
              >
                <option value="">No template — write message below</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </select>

              <label htmlFor="message" className="mb-1.5 mt-4 block text-sm font-medium text-slate-300">
                Message
              </label>
              <textarea
                id="message"
                required
                rows={6}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="OSAJA'20 Welfare: your message here…"
                className="input-dark resize-y outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {segment.characterCount} chars · {segment.encoding} · {segment.pages} page
                  {segment.pages === 1 ? "" : "s"} · {segment.remainingInSegment} left in segment
                </span>
                <span className={segment.encoding === "UCS-2" ? "text-amber-300" : "text-slate-500"}>
                  {segment.encoding === "UCS-2" ? "Unicode shortens each page to 70 chars" : "GSM-7"}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block">
            <SmsPhonePreview message={message} />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
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
                  className={`cursor-pointer rounded-xl border px-3 py-3 transition active:scale-[0.99] ${
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
            <div className="mt-4 space-y-2">
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search members…"
                className="input-dark outline-none focus:border-brand-gold"
              />
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
                {filteredMembers.length === 0 ? (
                  <p className="p-2 text-sm text-slate-400">No members match.</p>
                ) : (
                  filteredMembers.map((m) => (
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
              <p className="text-xs text-brand-gold">{selectedIds.length} selected</p>
            </div>
          ) : null}

          {group === "pending" ? (
            <div className="mt-4 rounded-xl border border-dashed border-brand-gold/30 bg-brand-gold/5 p-4">
              <p className="text-sm font-semibold text-white">Enter contacts to message</p>
              <p className="mt-1 text-xs text-slate-400">
                These people are not stored as members yet, so there is no roster to load. Paste numbers
                (and optional names) below.
              </p>
              <label htmlFor="manual-phones" className="mb-1.5 mt-3 block text-sm font-medium text-slate-300">
                Contacts (required)
              </label>
              <textarea
                id="manual-phones"
                rows={5}
                value={manualPhones}
                onChange={(e) => setManualPhones(e.target.value)}
                placeholder={"One per line:\n0553995047\nAma Mensah, 0241234567\n+233544919953"}
                className="input-dark resize-y outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
            </div>
          ) : null}

          {group === "custom" ? (
            <div className="mt-4">
              <label htmlFor="manual-phones" className="mb-1.5 block text-sm font-medium text-slate-300">
                Additional contacts (optional)
              </label>
              <textarea
                id="manual-phones"
                rows={4}
                value={manualPhones}
                onChange={(e) => setManualPhones(e.target.value)}
                placeholder={"One per line:\n0553995047\n+233544919953"}
                className="input-dark resize-y outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-white">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Campaign</dt>
                  <dd className="truncate text-right text-slate-200">{name || "Auto-named"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Group</dt>
                  <dd className="text-right text-slate-200">{selectedGroup?.label ?? group}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Encoding</dt>
                  <dd className="text-right text-slate-200">{segment.encoding}</dd>
                </div>
              </dl>
              <p className="mt-4 line-clamp-4 rounded-xl bg-slate-950/50 p-3 text-sm text-slate-300">
                {message}
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
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
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <p className="mb-3 text-sm font-medium text-slate-300">Cost estimate</p>
                {estimating ? (
                  <p className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
                  </p>
                ) : estimate ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Recipients</dt>
                      <dd className="text-lg font-semibold text-white">{estimate.recipient_count}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Pages</dt>
                      <dd className="text-lg font-semibold text-white">{estimate.pages_per_message}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Credits</dt>
                      <dd className="text-lg font-semibold text-brand-gold">{estimate.estimated_units}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Invalid</dt>
                      <dd className="text-lg font-semibold text-white">{estimate.invalid_phone_count}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-slate-400">Unable to estimate yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <SmsPhonePreview message={message} />
          </div>
        </div>
      ) : null}

      <SmsStickyActions>
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setStep((s) => s - 1);
            }}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5 lg:flex-none"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <span className="hidden flex-1 lg:block" />
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={step === 0 && !canNextFromMessage}
            className="inline-flex flex-[1.4] items-center justify-center gap-1 rounded-xl bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light disabled:opacity-50 lg:flex-none lg:px-8"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light disabled:opacity-60 lg:flex-none lg:px-8"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : scheduleAt ? (
              <CalendarClock className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            {sending ? "Submitting…" : scheduleAt ? "Schedule" : "Send now"}
          </button>
        )}
      </SmsStickyActions>
    </div>
  );
}
