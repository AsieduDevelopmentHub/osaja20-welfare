/** Parse Supabase password-recovery tokens from the redirect URL. */

export interface RecoveryParseResult {
  accessToken: string | null;
  error: string | null;
  pending: boolean;
}

export function parseRecoveryFromUrl(): RecoveryParseResult {
  if (typeof window === "undefined") {
    return { accessToken: null, error: null, pending: true };
  }

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  const errorRaw = query.get("error_description") || query.get("error");
  if (errorRaw) {
    return {
      accessToken: null,
      error: decodeURIComponent(errorRaw.replace(/\+/g, " ")),
      pending: false,
    };
  }

  const type = hash.get("type") || query.get("type");
  const accessToken = hash.get("access_token") || query.get("access_token");

  if (type === "recovery" && accessToken) {
    return { accessToken, error: null, pending: false };
  }

  return { accessToken: null, error: null, pending: false };
}

export function hasRecoveryHash(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.includes("type=recovery");
}

export function resetPasswordRedirectUrl(): string {
  if (typeof window === "undefined") return "/reset-password";
  return `${window.location.origin}/reset-password`;
}
