"use client";

import type { Member, UserRole } from "@osaja/types";
import { MemberListSkeleton } from "@osaja/ui";
import { RefreshCw, Search, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { mapMember, type MemberListResponse } from "@/lib/types";

const ROLES: UserRole[] = ["member", "executive", "administrator"];

export default function MembersPage() {
  const { member: admin } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError("");
    try {
      if (query.trim()) {
        const res = await apiFetch<Record<string, unknown>[]>(
          `/members/search?q=${encodeURIComponent(query.trim())}&limit=50`
        );
        const items = (res.data ?? []).map((raw) => mapMember(raw));
        setMembers(items);
        setTotal(items.length);
        setTotalPages(1);
        setPage(1);
      } else {
        const res = await apiFetch<MemberListResponse>(`/members?page=${page}&page_size=20`);
        const data = res.data;
        setMembers((data?.items ?? []).map((raw) => mapMember(raw)));
        setTotal(data?.total ?? 0);
        setTotalPages(data?.total_pages ?? 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [admin, page, query]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(searchInput);
  };

  const promoteRole = async (memberId: string, role: UserRole) => {
    if (admin?.role !== "administrator") return;
    setUpdatingId(memberId);
    try {
      await apiFetch(`/members/${memberId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/20">
            <Users className="h-5 w-5 text-brand-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Members</h1>
            <p className="text-sm text-slate-400">{total} registered member{total === 1 ? "" : "s"}</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or membership ID..."
            className="w-full rounded-xl border border-slate-600 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-brand-gold"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setQuery("");
              setPage(1);
            }}
            className="flex items-center gap-1 rounded-xl border border-slate-600 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </form>

      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <MemberListSkeleton variant="dark" />
      ) : (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-brand-navy/60">
        {members.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No members found.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {members.map((m) => (
              <li key={m.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{m.fullName}</p>
                    <p className="truncate text-sm text-slate-400">{m.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">@{m.username}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">{m.membershipId}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 capitalize text-slate-300">{m.status}</span>
                      <span className="rounded-full bg-brand-gold/20 px-2 py-0.5 capitalize text-brand-gold">
                        {m.role ?? "member"}
                      </span>
                    </div>
                  </div>

                  {admin?.role === "administrator" && m.id !== admin.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={`role-${m.id}`} className="sr-only">
                        Role for {m.fullName}
                      </label>
                      <select
                        id={`role-${m.id}`}
                        value={m.role ?? "member"}
                        disabled={updatingId === m.id}
                        onChange={(e) => promoteRole(m.id, e.target.value as UserRole)}
                        className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-gold"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {!query && totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-600 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-600 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
