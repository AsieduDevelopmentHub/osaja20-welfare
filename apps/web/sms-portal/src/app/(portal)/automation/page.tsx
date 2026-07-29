"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Play, Plus, Trash2, Workflow } from "lucide-react";
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
  created_at: string | null;
  last_run_at: string | null;
}

interface RecipientGroup {
  id: string;
  label: string;
}

const TRIGGER_OPTIONS = [
  { id: "birthday", label: "Birthday celebrants", group: "birthdays_today" },
  { id: "outstanding_dues", label: "Outstanding dues", group: "outstanding_dues" },
  { id: "manual", label: "Manual / custom group", group: "active" },
];

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("birthday");
  const [recipientGroup, setRecipientGroup] = useState("active");
  const [message, setMessage] = useState(
    "Happy Birthday from OSAJA'20 Welfare! Wishing you joy, health, and a wonderful year ahead."
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [wfRes, groupRes] = await Promise.all([
        apiFetch<WorkflowItem[]>("/sms/workflows"),
        apiFetch<RecipientGroup[]>("/sms/recipients/groups"),
      ]);
      setWorkflows(wfRes.data ?? []);
      setGroups((groupRes.data ?? []).filter((g) => g.id !== "custom"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const manualGroups = useMemo(
    () => groups.filter((g) => !["birthdays_today", "outstanding_dues"].includes(g.id)),
    [groups]
  );

  useEffect(() => {
    const preset = TRIGGER_OPTIONS.find((t) => t.id === trigger);
    if (!preset) return;
    if (trigger !== "manual") {
      setRecipientGroup(preset.group);
    }
    if (!message.trim()) {
      if (trigger === "birthday") {
        setMessage(
          "Happy Birthday from OSAJA'20 Welfare! Wishing you joy, health, and a wonderful year ahead."
        );
      } else if (trigger === "outstanding_dues") {
        setMessage(
          "OSAJA'20 Welfare reminder: your monthly dues are still outstanding. Please pay via the member portal. Thank you."
        );
      }
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

  const onDelete = async (id: string) => {
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/sms/workflows/${id}`, { method: "DELETE" });
      setSuccess("Workflow deleted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workflow");
    }
  };

  const onRun = async (id: string) => {
    setRunningId(id);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch<{ submitted?: number; estimated_units?: number }>(
        `/sms/workflows/${id}/run`,
        { method: "POST" }
      );
      setSuccess(
        `Workflow submitted — ${res.data?.submitted ?? 0} recipient(s), ~${res.data?.estimated_units ?? 0} credit(s).`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run workflow");
    } finally {
      setRunningId(null);
    }
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
        description="Create your own SMS workflows, run them anytime, and delete ones you no longer need."
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
              placeholder="Birthday wishes"
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
          title="No workflows yet"
          description="Create a birthday, dues reminder, or custom group workflow to get started."
        />
      ) : (
        <ul className="space-y-3">
          {workflows.map((wf) => (
            <li key={wf.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">{wf.name}</h2>
                    <SmsStatusBadge status={wf.enabled ? "enabled" : "draft"} />
                  </div>
                  <p className="mt-1 text-xs capitalize text-slate-500">
                    {wf.trigger.replace(/_/g, " ")} · {wf.recipient_group.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRun(wf.id)}
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
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
