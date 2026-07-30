"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Skeleton } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsEmptyState, SmsPageHeader, SmsStatusBadge } from "@/components/sms-ui";

interface Template {
  id: string;
  name: string;
  body: string;
  category: string;
  linked_trigger: string | null;
  created_at: string | null;
}

const PRESET_CATEGORIES = ["general", "birthday", "reminder", "announcement", "election", "custom"];

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [categoryMode, setCategoryMode] = useState("general");
  const [customCategory, setCustomCategory] = useState("");
  const [linkedTrigger, setLinkedTrigger] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Template[]>("/sms/templates");
      setItems(res.data ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resolvedCategory =
    categoryMode === "custom" ? customCategory.trim() || "custom" : categoryMode;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/sms/templates", {
        method: "POST",
        body: JSON.stringify({
          name,
          body,
          category: resolvedCategory,
          linked_trigger: linkedTrigger || null,
        }),
      });
      setName("");
      setBody("");
      setCategoryMode("general");
      setCustomCategory("");
      setLinkedTrigger("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const onLink = async (id: string, trigger: string) => {
    try {
      await apiFetch(`/sms/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ linked_trigger: trigger || null }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    }
  };

  const onDelete = async (id: string) => {
    try {
      await apiFetch(`/sms/templates/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  return (
    <div className="space-y-5">
      <SmsPageHeader
        title="Templates"
        description="Reusable drafts. Link a birthday template to power the birthday workflow."
      />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}

      <form onSubmit={onCreate} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-white">New template</h2>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template title"
          className="input-dark outline-none focus:border-brand-gold"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Category
            <select
              value={categoryMode}
              onChange={(e) => setCategoryMode(e.target.value)}
              className="input-dark mt-1.5 outline-none focus:border-brand-gold"
            >
              {PRESET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === "custom" ? "Custom title…" : c}
                </option>
              ))}
            </select>
          </label>
          {categoryMode === "custom" ? (
            <label className="block text-sm text-slate-300">
              Custom category title
              <input
                required
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. Welfare update"
                className="input-dark mt-1.5 outline-none focus:border-brand-gold"
              />
            </label>
          ) : (
            <label className="block text-sm text-slate-300">
              Use for workflow
              <select
                value={linkedTrigger}
                onChange={(e) => setLinkedTrigger(e.target.value)}
                className="input-dark mt-1.5 outline-none focus:border-brand-gold"
              >
                <option value="">Not linked</option>
                <option value="birthday">Birthday workflow</option>
                <option value="outstanding_dues">Outstanding dues workflow</option>
                <option value="dues_month_end">Month-end dues workflow</option>
                <option value="members_yet_to_join">Members yet to join workflow</option>
              </select>
            </label>
          )}
        </div>
        {categoryMode === "custom" ? (
          <label className="block text-sm text-slate-300">
            Use for workflow
            <select
              value={linkedTrigger}
              onChange={(e) => setLinkedTrigger(e.target.value)}
              className="input-dark mt-1.5 outline-none focus:border-brand-gold"
            >
              <option value="">Not linked</option>
              <option value="birthday">Birthday workflow</option>
              <option value="outstanding_dues">Outstanding dues workflow</option>
              <option value="dues_month_end">Month-end dues workflow</option>
              <option value="members_yet_to_join">Members yet to join workflow</option>
            </select>
          </label>
        ) : null}
        <textarea
          required
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="OSAJA'20 Welfare: your message here…"
          className="input-dark resize-y outline-none focus:border-brand-gold"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save template"}
        </button>
      </form>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="dark" className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <SmsEmptyState icon={FileText} title="No templates yet" description="Create reusable drafts for campaigns and workflows." />
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs capitalize text-brand-gold">{t.category}</p>
                    {t.linked_trigger ? <SmsStatusBadge status="enabled" /> : null}
                    {t.linked_trigger ? (
                      <span className="text-[11px] text-slate-500">
                        Powers {t.linked_trigger.replace(/_/g, " ")} workflow
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{t.body}</p>
                  <select
                    value={t.linked_trigger || ""}
                    onChange={(e) => onLink(t.id, e.target.value)}
                    className="input-dark mt-3 max-w-xs outline-none focus:border-brand-gold"
                  >
                    <option value="">Not linked to a workflow</option>
                    <option value="birthday">Link to birthday workflow</option>
                    <option value="outstanding_dues">Link to outstanding dues</option>
                    <option value="dues_month_end">Link to month-end dues</option>
                    <option value="members_yet_to_join">Link to members yet to join</option>
                    <option value="members_yet_to_join">Link to members yet to join</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-red-300"
                  aria-label={`Delete ${t.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
