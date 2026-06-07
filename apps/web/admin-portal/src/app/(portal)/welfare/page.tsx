"use client";

import type { Member } from "@osaja/types";
import { ListRowsSkeleton } from "@osaja/ui";
import { HeartHandshake, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { MemberSearchInput } from "@/components/MemberSearchInput";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, WelfareCaseItem } from "@/lib/types";
import { WELFARE_STATUS_LABELS } from "@/lib/types";

const STATUS_FILTERS = ["", "created", "executive_review", "approved", "support_allocated", "resolved"];

export default function WelfarePage() {
  const [cases, setCases] = useState<WelfareCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<WelfareCaseItem | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createMember, setCreateMember] = useState<Member | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `&status=${statusFilter}` : "";
      const res = await apiFetch<PaginatedResponse<WelfareCaseItem>>(`/welfare/cases?page=1&page_size=50${q}`);
      setCases(res.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const transition = async (caseId: string, target: string) => {
    setBusy(true);
    setSuccess("");
    setError("");
    try {
      await apiFetch(`/welfare/cases/${caseId}/transition`, {
        method: "PATCH",
        body: JSON.stringify({ target_status: target }),
      });
      setSuccess("Case status updated.");
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setBusy(false);
    }
  };

  const createCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createMember) {
      setError("Select a member from the search results before creating a case.");
      return;
    }
    setBusy(true);
    setSuccess("");
    setError("");
    try {
      await apiFetch("/welfare/cases", {
        method: "POST",
        body: JSON.stringify({
          member_id: createMember.id,
          title: createTitle.trim(),
          description: createDesc.trim(),
        }),
      });
      setSuccess("Welfare case created.");
      setShowCreate(false);
      setCreateMember(null);
      setCreateTitle("");
      setCreateDesc("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Welfare cases"
        description="Review requests, approve support, and track case workflow."
        action={
          <button
            type="button"
            onClick={() => {
              setShowCreate((v) => !v);
              setError("");
              setSuccess("");
            }}
            className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark"
          >
            <Plus className="h-4 w-4" />
            New case
          </button>
        }
      />

      {success ? <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</p> : null}
      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      {showCreate ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-brand-navy/60 p-5">
          <h2 className="font-semibold text-white">Create case for member</h2>
          <MemberSearchInput onSelect={setCreateMember} selected={createMember} />
          <form onSubmit={createCase} className="space-y-4">
            <input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              required
              minLength={3}
              placeholder="Case title"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
            />
            <textarea
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              required
              minLength={10}
              rows={4}
              placeholder="Describe the welfare need..."
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-white"
            />
            <button
              type="submit"
              disabled={busy || !createMember}
              className="rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-50"
            >
              {busy ? "Creating..." : "Create case"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === s ? "bg-brand-gold text-brand-navy-dark" : "bg-white/10 text-slate-300"
            }`}
          >
            {s ? WELFARE_STATUS_LABELS[s] ?? s : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <ListRowsSkeleton rows={5} variant="dark" />
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-brand-navy/60 p-10 text-center text-slate-400">
          <HeartHandshake className="mx-auto mb-3 h-10 w-10" />
          No welfare cases found.
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-brand-navy/60 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{c.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    <Link href={`/profile/${c.member_id}`} className="text-brand-gold hover:underline">
                      {c.member_name}
                    </Link>
                    {" · "}
                    {c.membership_id}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-300">{c.description}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs capitalize text-slate-200">
                    {WELFARE_STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className="text-xs font-medium text-brand-gold hover:underline"
                  >
                    {selected?.id === c.id ? "Hide actions" : "Manage"}
                  </button>
                </div>
              </div>
              {selected?.id === c.id && c.available_transitions?.length ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                  {c.available_transitions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={busy}
                      onClick={() => transition(c.id, t)}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50"
                    >
                      → {WELFARE_STATUS_LABELS[t] ?? t}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
