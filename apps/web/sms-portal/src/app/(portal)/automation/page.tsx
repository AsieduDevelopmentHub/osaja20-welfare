"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  Workflow,
} from "lucide-react";
import { Skeleton } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsEmptyState, SmsPageHeader, SmsStatusBadge } from "@/components/sms-ui";

interface WorkflowItem {
  id: string;
  name: string;
  trigger: string;
  recipient_group: string;
  message: string;
  enabled: boolean;
  template_id?: string | null;
  created_at: string | null;
  last_run_at: string | null;
  is_default?: boolean;
  requires_phones?: boolean;
}

interface Template {
  id: string;
  name: string;
  linked_trigger?: string | null;
}

interface RecipientGroup {
  id: string;
  label: string;
}

const MEMBER_PORTAL = "https://member.osajawelfare.org";

const TRIGGER_OPTIONS = [
  { id: "birthday", label: "Birthday celebrants", group: "birthdays_today" },
  { id: "outstanding_dues", label: "Outstanding dues", group: "outstanding_dues" },
  { id: "dues_month_end", label: "Month ending · dues unpaid", group: "outstanding_dues" },
  { id: "members_yet_to_join", label: "Members yet to join", group: "pending" },
  { id: "manual", label: "Manual / custom group", group: "active" },
];

function splitPhones(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function needsPhones(wf: WorkflowItem): boolean {
  return (
    Boolean(wf.requires_phones) ||
    wf.trigger === "members_yet_to_join" ||
    wf.recipient_group === "pending"
  );
}

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [phonePromptId, setPhonePromptId] = useState<string | null>(null);
  const [runPhones, setRunPhones] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("birthday");
  const [recipientGroup, setRecipientGroup] = useState("active");
  const [message, setMessage] = useState(
    "Dear member,\n\nHappy Birthday from the OSAJA Welfare family! We wish you joy, good health, and a wonderful year ahead.\n\nThank you,\nOSAJA Welfare Team"
  );
  const [templateId, setTemplateId] = useState("");

  const [editName, setEditName] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editTemplateId, setEditTemplateId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [wfRes, groupRes, tplRes] = await Promise.all([
        apiFetch<WorkflowItem[]>("/sms/workflows"),
        apiFetch<RecipientGroup[]>("/sms/recipients/groups"),
        apiFetch<Template[]>("/sms/templates"),
      ]);
      setWorkflows(wfRes.data ?? []);
      setGroups(groupRes.data ?? []);
      setTemplates(tplRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const manualGroups = useMemo(() => groups.filter((g) => g.id !== "custom"), [groups]);

  useEffect(() => {
    const preset = TRIGGER_OPTIONS.find((t) => t.id === trigger);
    if (!preset || trigger === "manual") return;
    if (trigger === "outstanding_dues") {
      setMessage(
        `Dear member,\n\nThis is a kind reminder that your monthly welfare dues are still outstanding. Our ability to support one another depends on our collective commitment.\n\nPlease pay your dues at ${MEMBER_PORTAL}\n\nThank you,\nOSAJA Welfare Team`
      );
    } else if (trigger === "dues_month_end") {
      setMessage(
        `Dear member,\n\nThe month is ending soon and your welfare dues remain unpaid. Kindly settle them so we can continue supporting one another as a family.\n\nPay at ${MEMBER_PORTAL}\n\nThank you,\nOSAJA Welfare Team`
      );
    } else if (trigger === "members_yet_to_join") {
      setMessage(
        `Dear friend,\n\nIf you have not yet joined the OLD Students of Asuofua JHS A (OSAJA) Welfare Group, we warmly encourage you to join today. The welfare scheme is here to support all of us, and that support depends on our collective commitment.\n\nJoin the welfare group, pay your monthly dues, and be an active part of our support system.\n\nJoin and register at ${MEMBER_PORTAL}\n\nThank you,\nOSAJA Welfare Team`
      );
    } else if (trigger === "birthday") {
      setMessage(
        "Dear member,\n\nHappy Birthday from the OSAJA Welfare family! We wish you joy, good health, and a wonderful year ahead.\n\nThank you,\nOSAJA Welfare Team"
      );
    }
  }, [trigger]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/sms/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          trigger,
          recipient_group: trigger === "manual" ? recipientGroup : undefined,
          message: message.trim(),
          enabled: true,
          template_id: templateId || null,
        }),
      });
      setName("");
      setShowCreate(false);
      setSuccess("Workflow created");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (wf: WorkflowItem) => {
    setEditingId(wf.id);
    setPhonePromptId(null);
    setEditName(wf.name);
    setEditMessage(wf.message);
    setEditEnabled(wf.enabled);
    setEditTemplateId(wf.template_id || "");
  };

  const onSaveEdit = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/sms/workflows/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName,
          message: editMessage,
          enabled: editEnabled,
          template_id: editTemplateId || null,
          clear_template: !editTemplateId,
        }),
      });
      setEditingId(null);
      setSuccess("Workflow updated");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workflow");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setError("");
    try {
      await apiFetch(`/sms/workflows/${id}`, { method: "DELETE" });
      setSuccess("Workflow removed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workflow");
    }
  };

  const executeRun = async (id: string, phones: string[] = []) => {
    setRunningId(id);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch<{ submitted?: number; estimated_units?: number }>(
        `/sms/workflows/${id}/run`,
        {
          method: "POST",
          body: JSON.stringify({ phones }),
        }
      );
      setSuccess(
        `Workflow submitted — ${res.data?.submitted ?? 0} recipient(s), ~${res.data?.estimated_units ?? 0} credit(s).`
      );
      setPhonePromptId(null);
      setRunPhones("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run workflow");
    } finally {
      setRunningId(null);
    }
  };

  const onRunClick = (wf: WorkflowItem) => {
    setError("");
    setSuccess("");
    if (needsPhones(wf)) {
      setEditingId(null);
      setPhonePromptId(wf.id);
      setRunPhones("");
      return;
    }
    void executeRun(wf.id);
  };

  const onConfirmPhoneRun = async (e: FormEvent) => {
    e.preventDefault();
    if (!phonePromptId) return;
    const phones = splitPhones(runPhones);
    if (phones.length === 0) {
      setError("Paste at least one phone number to run this workflow");
      return;
    }
    await executeRun(phonePromptId, phones);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="dark" className="h-8 w-56" />
        <Skeleton variant="dark" className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SmsPageHeader
        title="Automation"
        description="Defaults include birthday, dues, and members yet to join. Dues/join messages link to the member portal."
        action={
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
          >
            <Plus className="h-4 w-4" />
            {showCreate ? "Close" : "New workflow"}
          </button>
        }
      />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}
      {success ? <SmsAlert variant="success">{success}</SmsAlert> : null}

      {showCreate ? (
        <form onSubmit={onCreate} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <label className="block text-sm font-medium text-slate-300">
            Workflow name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Meeting reminder"
              className="input-dark mt-1.5 outline-none focus:border-brand-gold"
            />
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Trigger
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="input-dark mt-1.5 outline-none focus:border-brand-gold"
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {trigger === "manual" ? (
            <label className="block text-sm font-medium text-slate-300">
              Recipient group
              <select
                value={recipientGroup}
                onChange={(e) => setRecipientGroup(e.target.value)}
                className="input-dark mt-1.5 outline-none focus:border-brand-gold"
              >
                {manualGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {trigger === "members_yet_to_join" ? (
            <p className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-3 py-2 text-xs text-slate-400">
              Running this workflow will ask you to paste phone numbers — there is no DB roster yet.
            </p>
          ) : null}
          <label className="block text-sm font-medium text-slate-300">
            Use template (optional)
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="input-dark mt-1.5 outline-none focus:border-brand-gold"
            >
              <option value="">None — use message below</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.linked_trigger ? ` · linked ${t.linked_trigger}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Message
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input-dark mt-1.5 resize-y outline-none focus:border-brand-gold"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-gold py-3 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {saving ? "Creating…" : "Create workflow"}
          </button>
        </form>
      ) : null}

      {workflows.length === 0 ? (
        <SmsEmptyState
          icon={Workflow}
          title="No workflows"
          description="Create a birthday, dues, or custom workflow to get started."
        />
      ) : (
        <ul className="space-y-3">
          {workflows.map((wf) => (
            <li key={wf.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {editingId === wf.id ? (
                <div className="space-y-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-dark outline-none focus:border-brand-gold"
                  />
                  <textarea
                    rows={3}
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    className="input-dark resize-y outline-none focus:border-brand-gold"
                  />
                  <select
                    value={editTemplateId}
                    onChange={(e) => setEditTemplateId(e.target.value)}
                    className="input-dark outline-none focus:border-brand-gold"
                  >
                    <option value="">No linked template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={editEnabled}
                      onChange={(e) => setEditEnabled(e.target.checked)}
                    />
                    Enabled
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSaveEdit(wf.id)}
                      disabled={saving}
                      className="rounded-xl bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy-dark"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-white">{wf.name}</h2>
                        <SmsStatusBadge status={wf.enabled ? "enabled" : "draft"} />
                        {wf.is_default ? (
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">Default</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {wf.trigger.replace(/_/g, " ")} · {wf.recipient_group.replace(/_/g, " ")}
                        {needsPhones(wf) ? " · asks for numbers on run" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onRunClick(wf)}
                        disabled={runningId === wf.id || !wf.enabled}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
                      >
                        {runningId === wf.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Run
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(wf)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-brand-gold"
                        aria-label={`Edit ${wf.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(wf.id)}
                        className="rounded-lg p-1.5 text-red-300 hover:bg-red-500/10"
                        aria-label={`Delete ${wf.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-slate-300">{wf.message}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Last run: {wf.last_run_at ? new Date(wf.last_run_at).toLocaleString() : "Never"}
                    {wf.template_id ? " · uses linked template at send time" : ""}
                  </p>

                  {phonePromptId === wf.id ? (
                    <form
                      onSubmit={onConfirmPhoneRun}
                      className="mt-4 space-y-2 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-3"
                    >
                      <p className="text-sm font-semibold text-white">Enter phone numbers to invite</p>
                      <p className="text-xs text-slate-400">
                        Members yet to join are not in the database. Paste numbers, then send.
                      </p>
                      <textarea
                        required
                        rows={4}
                        value={runPhones}
                        onChange={(e) => setRunPhones(e.target.value)}
                        placeholder={"One per line:\n0553995047\n+233544919953"}
                        className="input-dark resize-y outline-none focus:border-brand-gold"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={runningId === wf.id}
                          className="inline-flex items-center gap-1 rounded-xl bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy-dark disabled:opacity-60"
                        >
                          {runningId === wf.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          Send invites
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPhonePromptId(null);
                            setRunPhones("");
                          }}
                          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
