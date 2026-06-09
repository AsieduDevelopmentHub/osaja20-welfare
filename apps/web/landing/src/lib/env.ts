import { LANDING_PORTAL_URLS } from "@osaja/config";

function trimUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().replace(/\/$/, "");
  return trimmed || fallback;
}

export const portalUrls = {
  member: trimUrl(process.env.NEXT_PUBLIC_MEMBER_URL, LANDING_PORTAL_URLS.member),
  admin: trimUrl(process.env.NEXT_PUBLIC_ADMIN_URL, LANDING_PORTAL_URLS.admin),
};
