"use client";

import { smsModules, Skeleton, StatCard } from "@osaja/ui";
import {
  CalendarClock,
  MessageSquare,
  MessagesSquare,
  Percent,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface DashboardData {
  sms_sent_today: number;
  sms_sent_this_month: number;
  scheduled_messages: number;
  pending_campaigns: number;
  automatic_messages: number;
  failed_deliveries: number;
  delivery_success_rate: number | null;
  balance: { sms_balance?: string; main_balance?: string } | null;
  balance_error: string | null;
  arkesel_configured: boolean;
  sender_id: string;
  sandbox: boolean;
  recent_campaigns: {
    id: string;
    name: string;
    status: string;
    recipient_count: number;
    created_at: string | null;
  }[];
  recent_failed: {
    id: string;
    member_name: string | null;
    recipient_phone: string;
    status: string;
  }[];
}

function balanceCredits(data: DashboardData | null): string {
  if (!data?.arkesel_configured) return "Not configured";
  if (data.balance_error) return "Unavailable";
  const raw = data.balance as
    | { sms_balance?: string | number; data?: { sms_balance?: string | number } }
    | null
    | undefined;
  const sms = raw?.sms_balance ?? raw?.data?.sms_balance;
  if (sms != null && String(sms) !== "") return String(sms);
  return "—";
}

function walletBalance(data: DashboardData | null): string {
  if (!data?.arkesel_configured || data.balance_error) return "—";
  const raw = data.balance as
    | { main_balance?: string | number; data?: { main_balance?: string | number } }
    | null
    | undefined;
  const main = raw?.main_balance ?? raw?.data?.main_balance;
  if (main != null && String(main) !== "") return String(main);
  return "—";
}

export default function SmsDashboard() {
  const { member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!member) return;
    setLoading(true);
    setError("");
    apiFetch<DashboardData>("/sms/dashboard")
      .then((res) => setData(res.data ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [member]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="dark" className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="dark" className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "SMS sent today", value: String(data?.sms_sent_today ?? 0), icon: MessageSquare },
    {
      label: "SMS sent this month",
      value: String(data?.sms_sent_this_month ?? 0),
      icon: MessagesSquare,
      iconClassName: "text-brand-gold",
    },
    { label: "Scheduled messages", value: String(data?.scheduled_messages ?? 0), icon: CalendarClock },
    {
      label: "Pending campaigns",
      value: String(data?.pending_campaigns ?? 0),
      icon: MessagesSquare,
      iconClassName: "text-blue-400",
    },
    {
      label: "SMS credits",
      value: balanceCredits(data),
      icon: MessageSquare,
      iconClassName: "text-brand-gold",
    },
    {
      label: "Wallet (GHS)",
      value: walletBalance(data),
      icon: Wallet,
      iconClassName: "text-green-400",
    },
    {
      label: "Delivery success",
      value: data?.delivery_success_rate != null ? `${data.delivery_success_rate}%` : "—",
      icon: Percent,
      iconClassName: "text-emerald-400",
    },
    {
      label: "Failed deliveries",
      value: String(data?.failed_deliveries ?? 0),
      icon: XCircle,
      iconClassName: "text-red-400",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-gold">SMS management</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-slate-400">
            Welcome{member?.fullName ? `, ${member.fullName.split(" ")[0]}` : ""}. Sender{" "}
            <span className="text-brand-gold">{data?.sender_id ?? "—"}</span>
            {data?.sandbox ? " · sandbox on" : ""}.
          </p>
        </div>
        <Link
          href="/compose"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
        >
          <MessageSquare className="h-4 w-4" />
          Compose SMS
        </Link>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      {!data?.arkesel_configured ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Arkesel API key is not configured on the API. Add <code>ARKESEL_API_KEY</code> to{" "}
          <code>apps/api/.env</code>.
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            iconClassName={stat.iconClassName}
            variant="dark"
          />
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {smsModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-brand-gold/40 hover:bg-white/10"
              >
                <span className="rounded-xl bg-brand-navy p-2.5 text-brand-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{mod.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{mod.desc}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent campaigns</h3>
            <Link href="/campaigns" className="text-xs font-semibold text-brand-gold hover:underline">
              View all
            </Link>
          </div>
          {(data?.recent_campaigns.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No campaigns yet.</p>
          ) : (
            <ul className="space-y-2">
              {data?.recent_campaigns.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-200">{c.name}</span>
                  <span className="shrink-0 capitalize text-slate-400">
                    {c.status} · {c.recipient_count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent failed deliveries</h3>
            <Link href="/history" className="text-xs font-semibold text-brand-gold hover:underline">
              History
            </Link>
          </div>
          {(data?.recent_failed.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No failed deliveries this month.</p>
          ) : (
            <ul className="space-y-2">
              {data?.recent_failed.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-200">
                    {m.member_name || m.recipient_phone}
                  </span>
                  <span className="shrink-0 capitalize text-red-300">{m.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
