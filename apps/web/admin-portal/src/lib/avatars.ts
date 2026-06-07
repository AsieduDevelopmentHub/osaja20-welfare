import { getApiOrigin } from "./env";

export function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) return avatarUrl;
  const origin = getApiOrigin();
  return `${origin}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
}
