"use client";

import type { Member, MemberStatus, UserRole } from "@osaja/types";
import { Skeleton } from "@osaja/ui";
import { formatCurrency, formatDate } from "@osaja/utils";
import { ArrowLeft, Mail, Phone, User, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { resolveAvatarUrl } from "@/lib/avatars";
import { mapMember } from "@/lib/types";

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Active",
  inactive: "Deactivated",
  archived: "Archived",
  pending: "Pending",
};

const ROLES: UserRole[] = ["member", "executive", "administrator"];

interface MemberProfileViewProps {
  memberId: string;
  adminId?: string;
  adminRole?: string;
  onUpdated?: () => void;
  showBackLink?: boolean;
}

export function MemberProfileView({
  memberId,
  adminId,
  adminRole,
  onUpdated,
  showBackLink = false,
}: MemberProfileViewProps) {
  const [profile, setProfile] = useState<Member | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileRes, balanceRes] = await Promise.all([
        apiFetch<Record<string, unknown>>(`/members/${memberId}`),
        apiFetch<{ balance: number }>(`/members/${memberId}/balance`).catch(() => null),
      ]);
      setProfile(mapMember(profileRes.data as Record<string, unknown>));
      setBalance(balanceRes?.data?.balance ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (status: MemberStatus) => {
    if (!profile) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<Record<string, unknown>>(`/members/${memberId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setProfile(mapMember(res.data as Record<string, unknown>));
      setMessage("Account status updated.");
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const promoteRole = async (role: UserRole) => {
    if (!profile || adminRole !== "administrator") return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<Record<string, unknown>>(`/members/${memberId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setProfile(mapMember(res.data as Record<string, unknown>));
      setMessage("Role updated.");
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setBusy(false);
    }
  };

  const avatarSrc = resolveAvatarUrl(profile?.avatarUrl);

  return (
    <div className="space-y-6">
      {showBackLink ? (
        <Link
          href="/members"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-brand-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to members
        </Link>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton variant="dark" className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="dark" className="h-6 w-48" />
              <Skeleton variant="dark" className="h-4 w-32" />
              <Skeleton variant="dark" className="h-4 w-64" />
            </div>
          </div>
        ) : !profile ? (
          <p className="text-sm text-red-300">{error || "Member not found"}</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-brand-gold/40"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                  <User className="h-10 w-10 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-white">{profile.fullName}</h1>
                <p className="text-slate-400">
                  @{profile.username} · {profile.membershipId}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs capitalize text-slate-300">
                    {STATUS_LABELS[profile.status] ?? profile.status}
                  </span>
                  <span className="rounded-full bg-brand-gold/20 px-2.5 py-1 text-xs capitalize text-brand-gold">
                    {profile.role ?? "member"}
                  </span>
                  {balance != null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-300">
                      <Wallet className="h-3 w-3" />
                      {formatCurrency(balance)} balance
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="text-slate-200">{profile.email}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <dt className="text-xs text-slate-500">Phone</dt>
                  <dd className="text-slate-200">{profile.phoneNumber || "—"}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Date of birth</dt>
                <dd className="text-slate-200">{formatDate(profile.dateOfBirth)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Batch</dt>
                <dd className="text-slate-200">{profile.batch}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Registered</dt>
                <dd className="text-slate-200">
                  {profile.registrationDate ? formatDate(profile.registrationDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email verified</dt>
                <dd className="text-slate-200">{profile.emailVerified ? "Yes" : "No"}</dd>
              </div>
            </dl>

            {adminRole === "administrator" && profile.id !== adminId ? (
              <div className="border-t border-white/10 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Role</p>
                <select
                  value={profile.role ?? "member"}
                  disabled={busy}
                  onChange={(e) => promoteRole(e.target.value as UserRole)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {profile.id !== adminId ? (
              <div className="border-t border-white/10 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Account access</p>
                <div className="flex flex-wrap gap-2">
                  {profile.status !== "active" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus("active")}
                      className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  ) : null}
                  {profile.status === "active" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus("inactive")}
                      className="rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-300 disabled:opacity-50"
                    >
                      Deactivate / lock
                    </button>
                  ) : null}
                  {adminRole === "administrator" && profile.status !== "archived" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Archive ${profile.fullName}? They will not be able to sign in.`)) {
                          setStatus("archived");
                        }
                      }}
                      className="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-300 disabled:opacity-50"
                    >
                      Archive account
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
