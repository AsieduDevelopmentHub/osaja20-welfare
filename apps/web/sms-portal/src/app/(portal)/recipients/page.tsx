"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, MessageSquarePlus, Plus, Search, Trash2, Users } from "lucide-react";
import { Skeleton } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsEmptyState, SmsPageHeader } from "@/components/sms-ui";

interface RecipientGroup {
  id: string;
  label: string;
  description: string;
  count: number;
  total_members: number;
  requires_manual_phones?: boolean;
  builtin?: boolean;
  contacts?: { name?: string | null; phone: string }[];
}

interface MemberRow {
  id: string;
  full_name: string;
  membership_id: string;
  phone_number: string;
  phone_normalized: string | null;
  status: string;
  role?: string;
}

export default function RecipientsPage() {
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [selected, setSelected] = useState<string>("active");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [contactsRaw, setContactsRaw] = useState("");
  const [saving, setSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<RecipientGroup[]>("/sms/recipients/groups");
      const list = res.data ?? [];
      setGroups(list);
      if (list.length && !list.some((g) => g.id === selected)) {
        setSelected(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeGroup = groups.find((g) => g.id === selected);
  const isPending = selected === "pending";
  const isCustomPick = selected === "custom";
  const isSavedCustom = selected.startsWith("cg_");

  useEffect(() => {
    if (!selected || isPending || isCustomPick || isSavedCustom) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    apiFetch<MemberRow[]>(`/sms/recipients?group=${encodeURIComponent(selected)}`)
      .then((res) => setMembers(res.data ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [selected, isPending, isCustomPick, isSavedCustom]);

  const filtered = members.filter((m) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      m.full_name.toLowerCase().includes(needle) ||
      m.membership_id.toLowerCase().includes(needle) ||
      (m.phone_number || "").includes(needle) ||
      (m.phone_normalized || "").includes(needle)
    );
  });

  const parseContacts = () => {
    const lines = contactsRaw
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line) => {
      const parts = line.split(/[,|]/).map((p) => p.trim());
      if (parts.length >= 2) {
        const maybePhone = parts[parts.length - 1];
        const name = parts.slice(0, -1).join(" ");
        return { name, phone: maybePhone };
      }
      return { name: null, phone: parts[0] };
    });
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const created = await apiFetch<{ id: string }>("/sms/recipient-groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName, contacts: parseContacts() }),
      });
      setGroupName("");
      setContactsRaw("");
      setShowCreate(false);
      setSuccess("Recipient group created");
      await loadGroups();
      if (created.data?.id) setSelected(created.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (id: string) => {
    setError("");
    try {
      await apiFetch(`/sms/recipient-groups/${encodeURIComponent(id)}`, { method: "DELETE" });
      setSuccess(id.startsWith("cg_") ? "Custom group deleted" : "Group hidden from list");
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove group");
    }
  };

  const onRestore = async () => {
    try {
      await apiFetch("/sms/recipient-groups/restore-builtin", { method: "POST" });
      setSuccess("Built-in groups restored");
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore groups");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="dark" className="h-8 w-48" />
        <Skeleton variant="dark" className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SmsPageHeader
        title="Recipient Groups"
        description="Built-in welfare groups plus your own phone lists."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              <Plus className="h-4 w-4" />
              New group
            </button>
            <Link
              href={`/compose?group=${encodeURIComponent(
                selected === "custom" ? "active" : selected === "pending" ? "pending" : selected
              )}`}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Compose
            </Link>
          </div>
        }
      />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}
      {success ? <SmsAlert variant="success">{success}</SmsAlert> : null}

      {showCreate ? (
        <form onSubmit={onCreate} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-white">Create recipient group</h2>
          <input
            required
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            className="input-dark outline-none focus:border-brand-gold"
          />
          <textarea
            required
            rows={5}
            value={contactsRaw}
            onChange={(e) => setContactsRaw(e.target.value)}
            placeholder={"One contact per line:\n0553995047\nAma Mensah, 0241234567\n+233544919953"}
            className="input-dark resize-y outline-none focus:border-brand-gold"
          />
          <p className="text-xs text-slate-500">Numbers only, or Name, number on each line.</p>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save group"}
          </button>
        </form>
      ) : null}

      <div className="flex justify-end">
        <button type="button" onClick={onRestore} className="text-xs font-semibold text-brand-gold hover:underline">
          Restore hidden built-in groups
        </button>
      </div>

      <section className="grid gap-2 sm:grid-cols-2">
        {groups.map((g) => {
          const active = selected === g.id;
          return (
            <div
              key={g.id}
              className={`rounded-2xl border p-4 text-left transition ${
                active ? "border-brand-gold bg-brand-gold/10" : "border-white/10 bg-white/5"
              }`}
            >
              <button type="button" onClick={() => setSelected(g.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{g.label}</span>
                  <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-xs font-semibold text-brand-gold">
                    {g.count}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{g.description}</p>
              </button>
              <button
                type="button"
                onClick={() => onRemove(g.id)}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-red-300 hover:underline"
              >
                <Trash2 className="h-3 w-3" />
                {g.builtin ? "Hide group" : "Delete group"}
              </button>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">{activeGroup?.label ?? "Members"}</h2>
            <p className="text-xs text-slate-500">
              {isPending
                ? "Contacts are entered when you compose — nothing is stored as members yet."
                : "Preview phones that will be targeted"}
            </p>
          </div>
          {!isPending && !isCustomPick ? (
            <label className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter list…"
                className="input-dark pl-10 outline-none focus:border-brand-gold"
              />
            </label>
          ) : null}
        </div>

        {isPending ? (
          <div className="rounded-xl border border-dashed border-brand-gold/30 bg-brand-gold/5 p-4">
            <p className="text-sm font-semibold text-white">Paste contacts in Compose</p>
            <p className="mt-1 text-xs text-slate-400">
              Members yet to join are not in the database. Open Compose with this group selected and enter
              numbers (055… / +233… / 233…).
            </p>
            <Link
              href="/compose?group=pending"
              className="mt-4 inline-flex items-center gap-1 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark"
            >
              Compose with contacts
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : isCustomPick ? (
          <SmsEmptyState
            icon={Users}
            title="Custom selection lives in Compose"
            description="Pick individual members and paste extra numbers on the Compose screen."
            actionHref="/compose?group=custom"
            actionLabel="Open compose"
          />
        ) : isSavedCustom ? (
          <ul className="divide-y divide-white/5">
            {(activeGroup?.contacts || []).map((c, idx) => (
              <li key={`${c.phone}-${idx}`} className="flex items-center justify-between gap-3 py-3">
                <span className="truncate text-sm text-white">{c.name || "Contact"}</span>
                <span className="font-mono text-xs text-slate-300">{c.phone}</span>
              </li>
            ))}
          </ul>
        ) : loadingMembers ? (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
          </p>
        ) : filtered.length === 0 ? (
          <SmsEmptyState
            icon={Users}
            title="No members in this group"
            description="Try another group or update member phone numbers in Admin."
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.slice(0, 80).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{m.full_name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {m.membership_id}
                    {m.role ? ` · ${m.role}` : ""} · {m.status}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-xs text-slate-300">
                  {m.phone_normalized || m.phone_number || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}

        {!isPending && !isCustomPick && selected ? (
          <Link
            href={`/compose?group=${encodeURIComponent(selected)}`}
            className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-brand-gold/40 bg-brand-gold/10 py-3 text-sm font-semibold text-brand-gold hover:bg-brand-gold/20"
          >
            Message this group
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </section>
    </div>
  );
}
