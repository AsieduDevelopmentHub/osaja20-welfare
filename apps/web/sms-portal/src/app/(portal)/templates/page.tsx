"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Template {
  id: string;
  name: string;
  body: string;
  category: string;
  created_at: string | null;
}

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
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

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/sms/templates", {
        method: "POST",
        body: JSON.stringify({ name, body, category }),
      });
      setName("");
      setBody("");
      setCategory("general");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
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
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand-gold">SMS Portal</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Templates</h1>
        <p className="mt-1 text-sm text-slate-400">Reusable drafts for campaigns and automation.</p>
      </header>

      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <form onSubmit={onCreate} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-white">New template</h2>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Birthday wishes"
          className="input-dark outline-none focus:border-brand-gold"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-dark outline-none focus:border-brand-gold"
        >
          <option value="general">General</option>
          <option value="birthday">Birthday</option>
          <option value="reminder">Reminder</option>
          <option value="announcement">Announcement</option>
          <option value="election">Election</option>
        </select>
        <textarea
          required
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="OSAJA'20 Welfare: Happy birthday {name}!"
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
        <p className="text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-brand-gold" />
          <p className="mt-4 text-sm font-semibold text-white">No templates yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="mt-1 text-xs capitalize text-brand-gold">{t.category}</p>
                  <p className="mt-2 text-sm text-slate-300">{t.body}</p>
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
