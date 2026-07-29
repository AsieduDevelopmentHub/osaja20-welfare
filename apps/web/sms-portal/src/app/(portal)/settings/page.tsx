"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface SmsSettings {
  arkesel_configured: boolean;
  sender_id: string;
  base_url: string;
  sandbox: boolean;
  api_key_set: boolean;
}

export default function SettingsPage() {
  const [data, setData] = useState<SmsSettings | null>(null);
  const [balance, setBalance] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [balanceError, setBalanceError] = useState("");

  useEffect(() => {
    apiFetch<SmsSettings>("/sms/settings")
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"));

    apiFetch<Record<string, unknown>>("/sms/balance")
      .then((res) => setBalance(res.data ?? null))
      .catch((err) => setBalanceError(err instanceof Error ? err.message : "Balance unavailable"));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand-gold">SMS Portal</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Arkesel provider configuration is managed via API environment variables.
        </p>
      </header>

      {error ? <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-brand-gold" />
          <h2 className="text-sm font-semibold text-white">Arkesel</h2>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">API key</dt>
            <dd className="text-sm font-semibold text-white">
              {data?.api_key_set ? "Configured" : "Missing"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Sender ID</dt>
            <dd className="text-sm font-semibold text-white">{data?.sender_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Base URL</dt>
            <dd className="truncate text-sm text-slate-300">{data?.base_url ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Sandbox default</dt>
            <dd className="text-sm font-semibold text-white">{data?.sandbox ? "On" : "Off"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Update <code>ARKESEL_API_KEY</code>, <code>ARKESEL_SENDER_ID</code> (max 11 chars), and{" "}
          <code>ARKESEL_SANDBOX</code> in <code>apps/api/.env</code>, then restart the API.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold text-white">Account balance</h2>
        {balanceError ? (
          <p className="text-sm text-amber-200">{balanceError}</p>
        ) : balance ? (
          <pre className="overflow-x-auto rounded-xl bg-slate-950/60 p-3 text-xs text-slate-300">
            {JSON.stringify(balance, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </div>
    </div>
  );
}
