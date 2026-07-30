import { getApiBase } from "./env";

export { getApiBase };

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

const TOKEN_KEY = "osaja_sms_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function parseApiError(json: unknown, status: number): string {
  if (typeof json === "object" && json !== null) {
    const obj = json as Record<string, unknown>;
    const detail = obj.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item === "object" && item && "msg" in item
            ? String((item as { msg: string }).msg)
            : String(item)
        )
        .join(", ");
    }
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
  }
  return `Request failed (${status})`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  let json: ApiResult<T> & { detail?: unknown };
  try {
    json = (await res.json()) as ApiResult<T> & { detail?: unknown };
  } catch {
    throw new Error(res.ok ? "Invalid server response" : `Request failed (${res.status})`);
  }
  if (!res.ok) {
    // Real auth failures only — Arkesel provider errors are mapped to 502 on the API.
    if (res.status === 401 && token) setToken(null);
    throw new Error(parseApiError(json, res.status));
  }
  return json;
}

/** Download authenticated binary/text responses (e.g. CSV export). */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}${path}`, { headers });
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    let message = `Download failed (${res.status})`;
    try {
      const json = await res.json();
      message = parseApiError(json, res.status);
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
