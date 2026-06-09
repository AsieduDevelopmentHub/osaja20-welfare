"use client";

import { Skeleton } from "@osaja/ui";
import { formatCurrency, formatDate } from "@osaja/utils";
import { Loader2, Mail, Phone, Save, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { apiFetch, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { resolveAvatarUrl } from "@/lib/avatars";
import { mapMember } from "@/lib/types";

export default function AdminSelfProfilePage() {
  const { member, refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingExtras, setLoadingExtras] = useState(true);

  useEffect(() => {
    if (!member) return;
    setFullName(member.fullName);
    setUsername(member.username);
    setPhoneNumber(member.phoneNumber);
    setDateOfBirth(member.dateOfBirth.slice(0, 10));
    setLoadingExtras(true);
    apiFetch<{ balance: number }>(`/members/${member.id}/balance`)
      .then((r) => setBalance(r.data?.balance ?? null))
      .catch(() => setBalance(null))
      .finally(() => setLoadingExtras(false));
  }, [member]);

  if (!member) return null;

  const avatarSrc = resolveAvatarUrl(member.avatarUrl);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim().toLowerCase(),
          phone_number: phoneNumber.trim(),
          date_of_birth: dateOfBirth,
        }),
      });
      await refresh();
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await apiUpload("/auth/profile/avatar", form);
      await refresh();
      setMessage("Profile photo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!member.avatarUrl) return;
    setUploading(true);
    setError("");
    try {
      await apiFetch("/auth/profile/avatar", { method: "DELETE" });
      await refresh();
      setMessage("Profile photo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="My profile"
        description="Your executive account — update contact details and photo."
      />

      <div aria-live="polite" aria-atomic="true">
        {message ? (
          <p className="mb-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Profile photo</h2>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
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
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy-dark">
              {uploading ? "Uploading..." : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                  e.target.value = "";
                }}
              />
            </label>
            {member.avatarUrl ? (
              <button
                type="button"
                disabled={uploading}
                onClick={removeAvatar}
                className="inline-flex items-center gap-2 text-sm text-red-300 hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove photo
              </button>
            ) : null}
            <p className="text-xs text-slate-500">JPEG, PNG, or WebP · max 2 MB</p>
          </div>
        </div>
      </section>

      <form onSubmit={saveProfile} className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Personal details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="admin-full-name">
              <input
                id="admin-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                className="input-dark w-full"
              />
            </Field>
            <Field label="Username" htmlFor="admin-username">
              <input
                id="admin-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                required
                minLength={3}
                maxLength={30}
                className="input-dark w-full"
              />
            </Field>
            <Field label="Phone number" htmlFor="admin-phone">
              <input
                id="admin-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                minLength={10}
                className="input-dark w-full"
              />
            </Field>
            <Field label="Date of birth" htmlFor="admin-dob">
              <input
                id="admin-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                className="input-dark w-full"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Account</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="text-slate-200">{member.email}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div>
                <dt className="text-xs text-slate-500">Member ID</dt>
                <dd className="font-mono text-slate-200">{member.membershipId}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Role</dt>
              <dd className="capitalize text-brand-gold">{member.role}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd className="capitalize text-slate-200">{member.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Registered</dt>
              <dd className="text-slate-200">
                {member.registrationDate ? formatDate(member.registrationDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Total contributions</dt>
              <dd className="text-slate-200">
                {loadingExtras ? (
                  <Skeleton variant="dark" className="inline-block h-4 w-24" />
                ) : balance != null ? (
                  formatCurrency(balance)
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Email and role changes require another administrator. Contact support if needed.
          </p>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold py-3 font-semibold text-brand-navy-dark disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}
