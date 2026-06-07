"use client";

import type { Member, MemberPreferences } from "@osaja/types";
import { DEFAULT_MEMBER_PREFERENCES } from "@/lib/profile";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { PushSettings } from "@/components/PushSettings";
import { SettingsToggle } from "@/components/SettingsToggle";
import { apiFetch, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { mapMember } from "@/lib/types";
import { preferencesToApi } from "@/lib/profile";

export default function SettingsPage() {
  const { member, setMember } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [prefs, setPrefs] = useState<MemberPreferences>(DEFAULT_MEMBER_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!member) return;
    setFullName(member.fullName);
    setUsername(member.username);
    setPhoneNumber(member.phoneNumber);
    setDateOfBirth(member.dateOfBirth.slice(0, 10));
    setPrefs(member.preferences ?? DEFAULT_MEMBER_PREFERENCES);
  }, [member]);

  if (!member) return null;

  const applyMember = (raw: Record<string, unknown>) => {
    const updated = mapMember(raw);
    setMember(updated);
    return updated;
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch<Record<string, unknown>>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim().toLowerCase(),
          phone_number: phoneNumber.trim(),
          date_of_birth: dateOfBirth,
          preferences: preferencesToApi(prefs),
        }),
      });
      applyMember(res.data as Record<string, unknown>);
      setMessage("Settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
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
      const res = await apiUpload<Record<string, unknown>>("/auth/profile/avatar", form);
      applyMember(res.data as Record<string, unknown>);
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
      const res = await apiFetch<Record<string, unknown>>("/auth/profile/avatar", { method: "DELETE" });
      applyMember(res.data as Record<string, unknown>);
      setMessage("Profile photo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setUploading(false);
    }
  };

  const setPref = <K extends keyof MemberPreferences>(key: K, value: MemberPreferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="Settings" description="Update your profile, photo, and notification preferences." />

      {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="glass-card p-5 sm:p-6">
        <h3 className="mb-4 font-semibold text-slate-900">Profile photo</h3>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <ProfileAvatar member={member} size="xl" editable uploading={uploading} onUpload={uploadAvatar} />
          <div className="text-center sm:text-left">
            <p className="text-sm text-slate-600">JPEG, PNG, or WebP · max 2 MB</p>
            {member.avatarUrl ? (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={uploading}
                className="mt-3 flex items-center gap-2 text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <form onSubmit={saveProfile} className="space-y-6">
        <section className="glass-card p-5 sm:p-6">
          <h3 className="mb-4 font-semibold text-slate-900">Personal details</h3>
          <div className="space-y-4">
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                className="input-field"
              />
            </Field>
            <Field label="Username">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-z0-9_]{3,30}"
                  className="input-field pl-8"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Used to sign in · lowercase letters, numbers, underscores</p>
            </Field>
            <Field label="Phone number">
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                minLength={10}
                type="tel"
                className="input-field"
              />
            </Field>
            <Field label="Date of birth">
              <input
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                type="date"
                className="input-field"
              />
            </Field>
          </div>
        </section>

        <PushSettings />

        <section className="glass-card divide-y divide-slate-100 px-5 sm:p-6">
          <div className="py-2">
            <h3 className="py-2 font-semibold text-slate-900">Notification preferences</h3>
            <p className="pb-2 text-xs text-slate-500">Control which types of alerts you receive when push is enabled.</p>
          </div>
          <SettingsToggle
            label="Dues reminders"
            description="Alerts when monthly dues are due or overdue"
            checked={prefs.notifyDues}
            onChange={(v) => setPref("notifyDues", v)}
          />
          <SettingsToggle
            label="Votes & governance"
            description="When new votes open or results are published"
            checked={prefs.notifyVotes}
            onChange={(v) => setPref("notifyVotes", v)}
          />
          <SettingsToggle
            label="Birthdays"
            description="Reminders when classmates celebrate"
            checked={prefs.notifyBirthdays}
            onChange={(v) => setPref("notifyBirthdays", v)}
          />
          <SettingsToggle
            label="Announcements"
            description="Official updates from the executive team"
            checked={prefs.notifyAnnouncements}
            onChange={(v) => setPref("notifyAnnouncements", v)}
          />
          <SettingsToggle
            label="Welfare updates"
            description="Cases and support activity relevant to you"
            checked={prefs.notifyWelfare}
            onChange={(v) => setPref("notifyWelfare", v)}
          />
          <SettingsToggle
            label="Celebrations"
            description="Community celebration notices"
            checked={prefs.notifyCelebrations}
            onChange={(v) => setPref("notifyCelebrations", v)}
          />
          <SettingsToggle
            label="Weekly email digest"
            description="Summary of activity (when email delivery is enabled)"
            checked={prefs.emailDigest}
            onChange={(v) => setPref("emailDigest", v)}
          />
        </section>

        <section className="glass-card p-5 sm:p-6">
          <h3 className="mb-4 font-semibold text-slate-900">Display</h3>
          <SettingsToggle
            label="Compact dashboard"
            description="Show a denser layout on your home screen"
            checked={prefs.compactDashboard}
            onChange={(v) => setPref("compactDashboard", v)}
          />
        </section>

        <section className="glass-card p-5 sm:p-6">
          <h3 className="mb-4 font-semibold text-slate-900">Account (read-only)</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="truncate font-medium text-slate-900">{member.email}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
              <dt className="text-slate-500">Member ID</dt>
              <dd className="font-mono font-medium text-slate-900">{member.membershipId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="capitalize font-medium text-slate-900">{member.status}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Email and Member ID are managed by the executive team. Contact an administrator to change them.
          </p>
        </section>

        <button type="submit" disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
