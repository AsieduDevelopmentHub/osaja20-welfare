/**
 * Public runtime config from `.env.local` (NEXT_PUBLIC_*).
 * Copy `.env.local.example` → `.env.local` and adjust values.
 */

import { parseWhatsAppNumbers } from "@osaja/utils";

const LOCAL_API = "http://localhost:8000/api/v1";

function read(key: string, fallback = ""): string {
  const value = process.env[key];
  return value?.trim() ? value.trim() : fallback;
}

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  apiUrl: read("NEXT_PUBLIC_API_URL"),
  appName: read("NEXT_PUBLIC_APP_NAME", "OSAJA'20 Welfare Admin"),
  currency: read("NEXT_PUBLIC_CURRENCY", "GHS"),
  monthlyDuesAmount: readNumber("NEXT_PUBLIC_MONTHLY_DUES_AMOUNT", 30),

  contact: {
    title: read("NEXT_PUBLIC_CONTACT_TITLE", "Contact us"),
    note: read(
      "NEXT_PUBLIC_CONTACT_NOTE",
      "Reach the welfare executives for dues, claims, or account help."
    ),
    email: read("NEXT_PUBLIC_CONTACT_EMAIL"),
    phone: read("NEXT_PUBLIC_CONTACT_PHONE"),
    whatsappNumbers: parseWhatsAppNumbers(read("NEXT_PUBLIC_WHATSAPP_NUMBER")),
    whatsappMessage: read(
      "NEXT_PUBLIC_WHATSAPP_MESSAGE",
      "Hello, I need assistance with OSAJA'20 Welfare."
    ),
  },
} as const;

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
