"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { Cake, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { BirthdayWishPanel } from "@/components/BirthdayWishPanel";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { apiFetch } from "@/lib/api";

interface Birthday {
  member_id: string;
  full_name: string;
  day: number;
  avatar_url?: string | null;
  membership_id?: string;
}

export default function BirthdaysPage() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedToday, setExpandedToday] = useState<string | null>(null);
  const month = new Date().toLocaleString("en-GH", { month: "long" });
  const today = new Date().getDate();

  useEffect(() => {
    const m = new Date().getMonth() + 1;
    setLoading(true);
    apiFetch<Birthday[]>(`/dashboard/birthdays?month=${m}`)
      .then((r) => setBirthdays((r.data as Birthday[]) ?? []))
      .catch(() => setBirthdays([]))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...birthdays].sort((a, b) => a.day - b.day);
  const todayBirthdays = sorted.filter((b) => b.day === today);

  return (
    <div className="space-y-6">
      <PageHeader title="Birthdays" description={`Celebrating members born in ${month}.`} />

      {todayBirthdays.length > 0 ? (
        <div className="space-y-4">
          {todayBirthdays.map((b) => (
            <div
              key={b.member_id}
              className="glass-card overflow-hidden bg-gradient-to-br from-amber-50/80 to-brand-gold/10"
            >
              <button
                type="button"
                onClick={() => setExpandedToday(expandedToday === b.member_id ? null : b.member_id)}
                className="flex w-full items-center gap-4 px-5 py-5 text-left sm:px-6"
              >
                <ProfileAvatar
                  member={{ fullName: b.full_name, avatarUrl: b.avatar_url ?? undefined }}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-900">Happy birthday, {b.full_name}!</p>
                  <p className="text-sm text-amber-800">
                    {expandedToday === b.member_id ? "Hide wishes" : "Tap to send or view wishes"}
                  </p>
                </div>
                <Gift className="h-6 w-6 shrink-0 text-amber-600" strokeWidth={1.75} />
              </button>
              {expandedToday === b.member_id ? (
                <div className="border-t border-amber-200/60 px-5 pb-5 sm:px-6">
                  <BirthdayWishPanel person={b} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <ListRowsSkeleton rows={5} variant="light" />
      ) : sorted.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={Cake} title="No birthdays this month" description="Check back next month for celebrations." />
        </div>
      ) : (
        <div className="glass-card divide-y divide-slate-100">
          {sorted.map((b) => {
            const isToday = b.day === today;
            return (
              <div
                key={b.member_id}
                className={`flex items-center gap-4 px-4 py-4 sm:px-6 ${isToday ? "bg-amber-50/50" : ""}`}
              >
                <ProfileAvatar
                  member={{ fullName: b.full_name, avatarUrl: b.avatar_url ?? undefined }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{b.full_name}</p>
                  <p className="text-sm text-slate-500">
                    {month} {b.day}
                    {isToday ? " · Today!" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
                  {b.day}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
