"use client";

import { env } from "@/lib/env";
import { formatCurrency } from "@osaja/utils";
import { ChevronRight, Mail, Phone, Receipt, Settings, Shield, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DuesStatusBanner } from "@/components/DuesStatusBanner";
import { PageHeader } from "@/components/PageHeader";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { mapDuesSummary } from "@/lib/types";
import type { DuesSummary } from "@osaja/types";

export default function ProfilePage() {
  const { member } = useAuth();
  const [dues, setDues] = useState<DuesSummary | null>(null);

  useEffect(() => {
    if (!member) return;
    apiFetch<Record<string, unknown>>("/members/me/dues")
      .then((r) => setDues(mapDuesSummary(r.data as Record<string, unknown>)))
      .catch(() => {});
  }, [member]);

  if (!member) return null;

  const rows = [
    { icon: User, label: "Full name", value: member.fullName },
    { icon: User, label: "Username", value: `@${member.username}` },
    { icon: Mail, label: "Email", value: member.email },
    { icon: Phone, label: "Phone", value: member.phoneNumber },
    { icon: Shield, label: "Member ID", value: member.membershipId },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your membership overview." />

      <div className="glass-card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-navy/5 to-brand-gold/5 px-5 py-6 sm:px-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <ProfileAvatar member={member} size="lg" />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-lg font-bold text-slate-900">{member.fullName}</p>
              <p className="text-sm text-slate-500">@{member.username}</p>
              <p className="mt-1 font-mono text-xs text-slate-400">{member.membershipId}</p>
              <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-emerald-700 ring-1 ring-emerald-200">
                {member.status}
              </span>
            </div>
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" />
              Edit profile
            </Link>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 px-4 py-4 sm:px-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                <Icon className="h-5 w-5 text-brand-600" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="truncate font-medium text-slate-900">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/contributions"
        className="glass-card flex items-center gap-4 p-4 transition hover:shadow-lg sm:p-5"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
          <Receipt className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Contributions & dues</p>
          <p className="text-sm text-slate-500">
            {dues
              ? `${formatCurrency(env.monthlyDuesAmount)}/month · Balance ${formatCurrency(dues.balance)}`
              : "View payment history and dues status"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
      </Link>

      {dues ? <DuesStatusBanner dues={dues} compact /> : null}
    </div>
  );
}
