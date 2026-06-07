"use client";

import type { Member, MemberStatus } from "@osaja/types";
import { formatDate } from "@osaja/utils";
import { Skeleton } from "@osaja/ui";
import { Mail, Phone, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { resolveAvatarUrl } from "@/lib/avatars";
import { mapMember } from "@/lib/types";

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Active",
  inactive: "Deactivated",
  archived: "Archived",
  pending: "Pending",
};

interface MemberProfilePanelProps {
  memberId: string;
  adminId?: string;
  adminRole?: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function MemberProfilePanel({ memberId, adminId, adminRole, onClose, onUpdated }: MemberProfilePanelProps) {
  const [profile, setProfile] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch<Record<string, unknown>>(`/members/${memberId}`)
      .then((res) => setProfile(mapMember(res.data as Record<string, unknown>)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [memberId]);

  const setStatus = async (status: MemberStatus) => {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch<Record<string, unknown>>(`/members/${memberId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setProfile(mapMember(res.data as Record<string, unknown>));
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const avatarSrc = resolveAvatarUrl(profile?.avatarUrl);

  return (
    <div className="rounded-2xl border border-brand-gold/30 bg-brand-navy/80 p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Member profile</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-4">
          <Skeleton variant="dark" className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="dark" className="h-5 w-48" />
            <Skeleton variant="dark" className="h-4 w-32" />
            <Skeleton variant="dark" className="h-4 w-64" />
          </div>
        </div>
      ) : !profile ? (
        <p className="text-sm text-red-300">{error || "Member not found"}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-gold/40" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <User className="h-8 w-8 text-slate-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold text-white">{profile.fullName}</p>
              <p className="text-sm text-slate-400">@{profile.username} · {profile.membershipId}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs capitalize text-slate-300">
                  {STATUS_LABELS[profile.status] ?? profile.status}
                </span>
                <span className="rounded-full bg-brand-gold/20 px-2 py-0.5 text-xs capitalize text-brand-gold">
                  {profile.role ?? "member"}
                </span>
              </div>
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
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

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
