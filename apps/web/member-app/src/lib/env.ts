/**
 * Public runtime config from `.env.local` (NEXT_PUBLIC_*).
 * Copy `.env.local.example` → `.env.local` and adjust values.
 */

const LOCAL_API = "http://localhost:8000/api/v1";

function read(key: string, fallback = ""): string {
  const value = process.env[key];
  return value?.trim() ? value.trim() : fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
}

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  /** Leave empty to auto-detect (localhost → :8000, tunnel → same-origin /api/v1) */
  apiUrl: read("NEXT_PUBLIC_API_URL"),

  appName: read("NEXT_PUBLIC_APP_NAME", "OSAJA'20 Welfare"),
  currency: read("NEXT_PUBLIC_CURRENCY", "GHS"),
  monthlyDuesAmount: readNumber("NEXT_PUBLIC_MONTHLY_DUES_AMOUNT", 30),

  payment: {
    title: read("NEXT_PUBLIC_PAYMENT_TITLE", "How to pay your dues"),
    note: read(
      "NEXT_PUBLIC_PAYMENT_NOTE",
      "After payment, the executive team will record it in the system within 24–48 hours. Contact the treasurer if your payment is not reflected."
    ),
    momo: {
      enabled: readBool("NEXT_PUBLIC_MOMO_ENABLED", true),
      label: read("NEXT_PUBLIC_MOMO_LABEL", "Mobile Money (MTN)"),
      detail: read(
        "NEXT_PUBLIC_MOMO_DETAIL",
        "Send your monthly dues to the welfare MoMo number below. Use your Member ID as the reference."
      ),
      number: read("NEXT_PUBLIC_MOMO_NUMBER", "024 XXX XXXX"),
      accountName: read("NEXT_PUBLIC_MOMO_ACCOUNT_NAME", "OSAJA'20 Welfare Fund"),
    },
    bank: {
      enabled: readBool("NEXT_PUBLIC_BANK_ENABLED", true),
      label: read("NEXT_PUBLIC_BANK_LABEL", "Bank transfer"),
      detail: read(
        "NEXT_PUBLIC_BANK_DETAIL",
        "Transfer to the welfare account. Share your receipt with the treasurer on WhatsApp."
      ),
      bankName: read("NEXT_PUBLIC_BANK_NAME", "GCB Bank"),
      accountName: read("NEXT_PUBLIC_BANK_ACCOUNT_NAME", "OSAJA'20 Welfare Fund"),
      accountNumber: read("NEXT_PUBLIC_BANK_ACCOUNT_NUMBER", "XXXX-XXXX-XXXX"),
    },
  },
} as const;

/** API base for browser `fetch` calls */
export function getApiBase(): string {
  if (env.apiUrl) return env.apiUrl.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${origin}/api/v1`;
    }
  }

  return LOCAL_API;
}

export function getApiOrigin(): string {
  return getApiBase().replace(/\/api\/v1\/?$/, "");
}
