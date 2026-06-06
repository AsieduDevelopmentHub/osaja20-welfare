"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { Cake, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";

interface Birthday {
  member_id: string;
  full_name: string;
  day: number;
}

export default function BirthdaysPage() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
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
        <div className="glass-card overflow-hidden bg-gradient-to-br from-amber-50/80 to-brand-gold/10">
          <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Gift className="h-6 w-6 text-amber-600" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-semibold text-amber-900">Birthday today!</p>
              <p className="text-sm text-amber-800">
                {todayBirthdays.map((b) => b.full_name).join(", ")}
              </p>
            </div>
          </div>
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
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    isToday ? "bg-amber-100 ring-2 ring-amber-300" : "bg-amber-50"
                  }`}
                >
                  <Cake className={`h-5 w-5 ${isToday ? "text-amber-700" : "text-amber-600"}`} strokeWidth={1.75} />
                </div>
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
