"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SmsAlert, SmsPageHeader } from "@/components/sms-ui";

interface SmsSettings {
  arkesel_configured: boolean;
  sender_id: string;
  base_url: string;
  api_key_set: boolean;
  delivery_webhook_enabled: boolean;
  public_api_url: string | null;
  callback_url: string | null;
  redis_cache_enabled?: boolean;
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
      <SmsPageHeader
        title="Settings"
        description="SMS provider configuration and account balance."
      />

      {error ? <SmsAlert variant="error">{error}</SmsAlert> : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-brand-gold" />
          <h2 className="text-sm font-semibold text-white">Provider</h2>
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
            <dt className="text-xs text-slate-500">Delivery webhook</dt>
            <dd className="text-sm font-semibold text-white">
              {data?.delivery_webhook_enabled ? "Enabled" : "Disabled"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Redis cache</dt>
            <dd className="text-sm font-semibold text-white">
              {data?.redis_cache_enabled ? "Connected" : "Unavailable (direct reads)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Callback URL</dt>
            <dd className="truncate text-sm text-slate-300">{data?.callback_url ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold text-white">Account balance</h2>
        {balanceError ? (
          <p className="text-sm text-amber-200">{balanceError}</p>
        ) : balance ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">SMS credits</dt>
              <dd className="text-lg font-semibold text-brand-gold">
                {String(balance.sms_balance ?? "—")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Wallet (GHS)</dt>
              <dd className="text-lg font-semibold text-white">
                {String(balance.main_balance ?? "—")}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </div>
    </div>
  );
}
