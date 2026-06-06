"use client";

import { DUES } from "@osaja/config";
import { formatCurrency } from "@osaja/utils";
import { BellRing, ChevronRight, Mail, Phone, Receipt, Shield, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DuesStatusBanner } from "@/components/DuesStatusBanner";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { mapDuesSummary } from "@/lib/types";
import type { DuesSummary } from "@osaja/types";

export default function ProfilePage() {
  const { member } = useAuth();
  const [pushStatus, setPushStatus] = useState("");
  const [dues, setDues] = useState<DuesSummary | null>(null);

  useEffect(() => {
    if (!member) return;
    apiFetch<Record<string, unknown>>("/members/me/dues")
      .then((r) => setDues(mapDuesSummary(r.data as Record<string, unknown>)))
      .catch(() => {});
  }, [member]);

  const enablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("Push notifications are not supported in this browser.");
      return;
    }
    try {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      setPushStatus("Service worker registered. Add VAPID keys on the server to enable push delivery.");
    } catch {
      setPushStatus("Could not register for push notifications.");
    }
  };

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
      <PageHeader title="Profile" description="Your membership details and notification settings." />

      <div className="glass-card overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-navy/5 to-brand-gold/5 px-5 py-6 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-navy text-xl font-bold text-white">
              {member.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{member.fullName}</p>
              <p className="text-sm text-slate-500">{member.membershipId}</p>
              <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-emerald-700 ring-1 ring-emerald-200">
                {member.status}
              </span>
            </div>
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
              ? `${formatCurrency(DUES.MONTHLY_AMOUNT)}/month · Balance ${formatCurrency(dues.balance)}`
              : "View payment history and dues status"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
      </Link>

      {dues ? <DuesStatusBanner dues={dues} compact /> : null}

      <div className="glass-card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-900">Push notifications</h3>
        <p className="mt-1 text-sm text-slate-500">
          Get alerts for dues reminders, votes, welfare updates, and birthdays.
        </p>
        <button type="button" onClick={enablePush} className="btn-primary mt-4 flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          Enable push
        </button>
        {pushStatus ? <p className="mt-3 text-sm text-slate-600">{pushStatus}</p> : null}
      </div>
    </div>
  );
}
