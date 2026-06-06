const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const TOKEN_KEY = "osaja_admin_token";

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

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
          typeof item === "object" && item && "msg" in item ? String((item as { msg: string }).msg) : String(item)
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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = (await res.json()) as ApiResult<T> & { detail?: unknown };

  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    throw new Error(parseApiError(json, res.status));
  }

  return json;
}
