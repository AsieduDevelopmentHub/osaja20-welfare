import type { MemberPreferences } from "@osaja/types";
import { getApiOrigin } from "./env";

export const DEFAULT_MEMBER_PREFERENCES: MemberPreferences = {
  notifyDues: true,
  notifyVotes: true,
  notifyBirthdays: true,
  notifyAnnouncements: true,
  notifyWelfare: true,
  notifyCelebrations: true,
  emailDigest: false,
  compactDashboard: false,
};

/** API snake_case ↔ frontend camelCase */
const PREF_KEY_MAP: Record<keyof MemberPreferences, string> = {
  notifyDues: "notify_dues",
  notifyVotes: "notify_votes",
  notifyBirthdays: "notify_birthdays",
  notifyAnnouncements: "notify_announcements",
  notifyWelfare: "notify_welfare",
  notifyCelebrations: "notify_celebrations",
  emailDigest: "email_digest",
  compactDashboard: "compact_dashboard",
};

export function mapPreferences(raw: Record<string, unknown> | undefined): MemberPreferences {
  if (!raw) return { ...DEFAULT_MEMBER_PREFERENCES };
  return {
    notifyDues: raw.notify_dues !== undefined ? Boolean(raw.notify_dues) : DEFAULT_MEMBER_PREFERENCES.notifyDues,
    notifyVotes: raw.notify_votes !== undefined ? Boolean(raw.notify_votes) : DEFAULT_MEMBER_PREFERENCES.notifyVotes,
    notifyBirthdays:
      raw.notify_birthdays !== undefined ? Boolean(raw.notify_birthdays) : DEFAULT_MEMBER_PREFERENCES.notifyBirthdays,
    notifyAnnouncements:
      raw.notify_announcements !== undefined
        ? Boolean(raw.notify_announcements)
        : DEFAULT_MEMBER_PREFERENCES.notifyAnnouncements,
    notifyWelfare:
      raw.notify_welfare !== undefined ? Boolean(raw.notify_welfare) : DEFAULT_MEMBER_PREFERENCES.notifyWelfare,
    notifyCelebrations:
      raw.notify_celebrations !== undefined
        ? Boolean(raw.notify_celebrations)
        : DEFAULT_MEMBER_PREFERENCES.notifyCelebrations,
    emailDigest: raw.email_digest !== undefined ? Boolean(raw.email_digest) : DEFAULT_MEMBER_PREFERENCES.emailDigest,
    compactDashboard:
      raw.compact_dashboard !== undefined
        ? Boolean(raw.compact_dashboard)
        : DEFAULT_MEMBER_PREFERENCES.compactDashboard,
  };
}

export function preferencesToApi(prefs: Partial<MemberPreferences>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [camel, snake] of Object.entries(PREF_KEY_MAP) as [keyof MemberPreferences, string][]) {
    const val = prefs[camel];
    if (val !== undefined) out[snake] = val;
  }
  return out;
}

export function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return `${getApiOrigin()}${avatarUrl}`;
}
