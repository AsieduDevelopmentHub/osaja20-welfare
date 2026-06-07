import { getApiBase } from "./env";

export { getApiBase };

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("osaja_admin_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("osaja_admin_token", token);
  else localStorage.removeItem("osaja_admin_token");
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

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  let json: ApiResult<T> & { detail?: unknown };
  try {
    json = (await res.json()) as ApiResult<T> & { detail?: unknown };
  } catch {
    throw new Error(res.ok ? "Invalid server response" : `Request failed (${res.status})`);
  }
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    throw new Error(parseApiError(json, res.status));
  }
  return json;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}${path}`, { method: "POST", headers, body: formData });
  let json: ApiResult<T> & { detail?: unknown };
  try {
    json = (await res.json()) as ApiResult<T> & { detail?: unknown };
  } catch {
    throw new Error(res.ok ? "Invalid server response" : `Request failed (${res.status})`);
  }
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    throw new Error(parseApiError(json, res.status));
  }
  return json;
}
