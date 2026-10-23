"use client";

import type { Member, UserRole } from "@osaja/types";
import { MemberListSkeleton } from "@osaja/ui";
import { RefreshCw, Search, User, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Alert, EmptyState, FilterPills, PaginationBar } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { resolveAvatarUrl } from "@/lib/avatars";
import { useAuth } from "@/lib/auth";
import { mapMember, type MemberListResponse } from "@/lib/types";

const ROLES: UserRole[] = ["member", "executive", "administrator"];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
  { value: "archived", label: "Archived" },
];

export default function MembersPage() {
  const { member: admin } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMembers = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError("");
    try {
      if (query.trim()) {
        const res = await apiFetch<Record<string, unknown>[]>(
          `/members/search?q=${encodeURIComponent(query.trim())}&limit=50`
        );
        let items = (res.data ?? []).map((raw) => mapMember(raw));
        if (statusFilter) items = items.filter((m) => m.status === statusFilter);
        setMembers(items);
        setTotal(items.length);
        setTotalPages(1);
      } else {
        const params = new URLSearchParams({
          page: String(page),
          page_size: "20",
        });
        if (statusFilter) params.set("status", statusFilter);
        const res = await apiFetch<MemberListResponse>(`/members?${params.toString()}`);
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
  }, [admin, page, query, statusFilter]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setQuery(searchInput.trim());
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const promoteRole = async (memberId: string, role: UserRole, currentRole?: string) => {
    if (admin?.role !== "administrator") return;
    if (role === (currentRole ?? "member")) return;
    const member = members.find((m) => m.id === memberId);
    const ok = window.confirm(
      `Change ${member?.fullName ?? "this member"}'s role from “${currentRole ?? "member"}” to “${role}”?`
    );
    if (!ok) {
      await loadMembers();
      return;
    }
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
      <AdminHeader
        icon={Users}
        title="Members"
        description={`${total} registered member${total === 1 ? "" : "s"}`}
        action={
          <button type="button" onClick={loadMembers} disabled={loading} className="btn-ghost">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or membership ID..."
            className="input-dark pl-10"
          />
        </div>
        <FilterPills
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
      </div>

      {error ? (
        <Alert tone="error" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <MemberListSkeleton variant="dark" />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description={query || statusFilter ? "Try adjusting search or status filters." : undefined}
        />
      ) : (
        <div className="admin-panel">
          <ul className="divide-y divide-white/5">
            {members.map((m) => {
              const avatarSrc = resolveAvatarUrl(m.avatarUrl);
              return (
                <li key={m.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${m.id}`}
                          className="truncate font-semibold text-white hover:text-brand-gold"
                        >
                          {m.fullName}
                        </Link>
                        <p className="truncate text-sm text-slate-400">{m.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">
                            @{m.username}
                          </span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">
                            {m.membershipId}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 capitalize ${
                              m.status === "active"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : m.status === "inactive"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-white/10 text-slate-300"
                            }`}
                          >
                            {m.status}
                          </span>
                          <span className="rounded-full bg-brand-gold/20 px-2 py-0.5 capitalize text-brand-gold">
                            {m.role ?? "member"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/profile/${m.id}`} className="btn-ghost px-3 py-2 text-xs">
                        View profile
                      </Link>
                      {admin?.role === "administrator" && m.id !== admin.id ? (
                        <select
                          id={`role-${m.id}`}
                          value={m.role ?? "member"}
                          disabled={updatingId === m.id}
                          onChange={(e) => promoteRole(m.id, e.target.value as UserRole, m.role)}
                          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-gold"
                          title="Confirm before changing role"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!query ? (
            <div className="border-t border-white/10 px-4 py-3 sm:px-6">
              <PaginationBar
                page={page}
                totalPages={totalPages}
                total={total}
                label="member"
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
