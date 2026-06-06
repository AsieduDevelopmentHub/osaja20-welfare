"use client";

import { StatCard, adminModules } from "@osaja/ui";
import { formatCurrency } from "@osaja/utils";
import { Cake, Download, Megaphone, Users, Vote, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    total_members: 0,
    active_members: 0,
    pending_welfare_cases: 0,
    total_contributions: 0,
    upcoming_birthdays_today: 0,
    active_votes: 0,
  });

  useEffect(() => {
    const token = localStorage.getItem("osaja_token");
    if (!token) return;
    fetch(`${API_BASE}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => j.data && setStats(j.data))
      .catch(() => {});
  }, []);

  const statCards = [
    { label: "Total Members", value: String(stats.total_members), icon: Users },
    { label: "Active Members", value: String(stats.active_members), icon: Users, iconClassName: "text-brand-gold" },
    { label: "Pending Welfare", value: String(stats.pending_welfare_cases), icon: Wallet },
    { label: "Contributions", value: formatCurrency(stats.total_contributions), icon: Wallet, iconClassName: "text-green-400" },
    { label: "Active Votes", value: String(stats.active_votes), icon: Vote, iconClassName: "text-purple-400" },
    { label: "Birthdays Today", value: String(stats.upcoming_birthdays_today), icon: Cake, iconClassName: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-gold">Administration</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">OSAJA&apos;20 Welfare</h1>
          <p className="text-sm text-slate-400">Leadership analytics & operations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
            <Download className="h-4 w-4" />
            Export
          </button>
          <a href="/announcements" className="flex items-center gap-2 rounded-xl bg-brand-gold px-3 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light">
            <Megaphone className="h-4 w-4" />
            Announce
          </a>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} variant="dark" />
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-brand-navy/60 p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Management Modules</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <a
                key={mod.name}
                href={mod.href}
                className="flex gap-4 rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 transition hover:border-brand-600/40 hover:bg-slate-800/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20">
                  <Icon className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{mod.name}</h3>
                  <p className="mt-0.5 text-sm text-slate-400">{mod.desc}</p>
                </div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
