"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, MessageSquarePlus, Search, Users } from "lucide-react";
import { Skeleton } from "@osaja/ui";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsEmptyState, SmsPageHeader } from "@/components/sms-ui";

interface RecipientGroup {
  id: string;
  label: string;
  description: string;
  count: number;
  total_members: number;
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

function RecipientsInner() {
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [selected, setSelected] = useState<string>("active");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

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

  useEffect(() => {
    if (!selected || selected === "custom") {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    apiFetch<MemberRow[]>(`/sms/recipients?group=${encodeURIComponent(selected)}`)
      .then((res) => setMembers(res.data ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [selected]);

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

  const activeGroup = groups.find((g) => g.id === selected);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="dark" className="h-8 w-48" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="dark" className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SmsPageHeader
        title="Recipient Groups"
        description="Live groups from the welfare database — no duplicate contact lists."
        action={
          <Link
            href={`/compose?group=${encodeURIComponent(selected === "custom" ? "active" : selected)}`}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Compose to group
          </Link>
        }
      />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}

      <section className="grid gap-2 sm:grid-cols-2">
        {groups.map((g) => {
          const active = selected === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(g.id)}
              className={`rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                active
                  ? "border-brand-gold bg-brand-gold/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-white">{g.label}</span>
                <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-xs font-semibold text-brand-gold">
                  {g.count}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{g.description}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                {g.total_members} in group · {g.count} valid phones
              </p>
            </button>
          );
        })}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">{activeGroup?.label ?? "Members"}</h2>
            <p className="text-xs text-slate-500">Preview phones that will be targeted</p>
          </div>
          <label className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter list…"
              className="input-dark pl-10 outline-none focus:border-brand-gold"
            />
          </label>
        </div>

        {selected === "custom" ? (
          <SmsEmptyState
            icon={Users}
            title="Custom selection lives in Compose"
            description="Use Compose → Custom Selection to pick individual members and paste extra numbers."
            actionHref="/compose?group=custom"
            actionLabel="Open compose"
          />
        ) : loadingMembers ? (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
          </p>
        ) : filtered.length === 0 ? (
          <SmsEmptyState
            icon={Users}
            title="No members in this group"
            description={
              selected === "pending"
                ? "Paste yet-to-join contacts in Compose, or wait for pending registrations."
                : "Try another group or update member phone numbers in Admin."
            }
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

        {filtered.length > 80 ? (
          <p className="mt-3 text-xs text-slate-500">Showing first 80 of {filtered.length}. Use Compose to message the full group.</p>
        ) : null}

        {selected !== "custom" && filtered.length > 0 ? (
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

export default function RecipientsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton variant="dark" className="h-8 w-48" />
          <Skeleton variant="dark" className="h-40 rounded-2xl" />
        </div>
      }
    >
      <RecipientsInner />
    </Suspense>
  );
}
