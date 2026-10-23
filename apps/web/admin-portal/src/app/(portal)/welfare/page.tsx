"use client";

import type { Member } from "@osaja/types";
import { ListRowsSkeleton } from "@osaja/ui";
import { HeartHandshake, Plus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { MemberSearchInput } from "@/components/MemberSearchInput";
import { AdminPanel, Alert, EmptyState, FilterPills, FormSection } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, WelfareCaseItem } from "@/lib/types";
import { WELFARE_STATUS_LABELS } from "@/lib/types";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: WELFARE_STATUS_LABELS.pending },
  { value: "approved", label: WELFARE_STATUS_LABELS.approved },
  { value: "allocated", label: WELFARE_STATUS_LABELS.allocated },
  { value: "resolved", label: WELFARE_STATUS_LABELS.resolved },
  { value: "archived", label: WELFARE_STATUS_LABELS.archived },
];

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

  const unarchive = async (caseId: string) => {
    setBusy(true);
    setSuccess("");
    setError("");
    try {
      await apiFetch(`/welfare/cases/${caseId}/unarchive`, { method: "PATCH" });
      setSuccess("Case restored from archive.");
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unarchive failed");
    } finally {
      setBusy(false);
    }
  };

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
        icon={HeartHandshake}
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
            className="btn-gold"
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? "Close" : "New case"}
          </button>
        }
      />

      {success ? (
        <Alert tone="success" onDismiss={() => setSuccess("")}>
          {success}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      {showCreate ? (
        <AdminPanel>
          <form onSubmit={createCase} className="space-y-5">
            <FormSection
              step={1}
              title="Member"
              description="Who is this welfare case for?"
            >
              <MemberSearchInput
                onSelect={setCreateMember}
                selected={createMember}
                onClear={() => setCreateMember(null)}
              />
            </FormSection>
            <FormSection step={2} title="Case details" description="Keep the title short; add context below.">
              <div className="space-y-3">
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  required
                  minLength={3}
                  placeholder="Case title"
                  className="input-dark"
                />
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  required
                  minLength={10}
                  rows={4}
                  placeholder="Describe the welfare need..."
                  className="input-dark"
                />
              </div>
            </FormSection>
            <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
              <button type="submit" disabled={busy || !createMember} className="btn-gold">
                {busy ? "Creating..." : "Create case"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminPanel>
      ) : null}

      <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <ListRowsSkeleton rows={5} variant="dark" />
      ) : cases.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No welfare cases found"
          description={statusFilter ? "Try another status filter." : "Create a case to get started."}
        />
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id} className="admin-panel p-4 sm:p-5">
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
              {selected?.id === c.id ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                  {c.available_transitions?.map((t) => (
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
                  {c.status === "archived" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unarchive(c.id)}
                      className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300"
                    >
                      Unarchive
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
