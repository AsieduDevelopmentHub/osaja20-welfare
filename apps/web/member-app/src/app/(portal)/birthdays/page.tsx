"use client";

import { Cake } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";

interface Birthday {
  member_id: string;
  full_name: string;
  day: number;
}

export default function BirthdaysPage() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const month = new Date().toLocaleString("en-GH", { month: "long" });

  useEffect(() => {
    const m = new Date().getMonth() + 1;
    apiFetch<Birthday[]>(`/dashboard/birthdays?month=${m}`)
      .then((r) => setBirthdays((r.data as Birthday[]) ?? []))
      .catch(() => setBirthdays([]));
  }, []);

  return (
    <div>
      <PageHeader title="Birthdays" description={`Celebrations in ${month}.`} />
      <div className="glass-card divide-y divide-slate-100">
        {birthdays.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-slate-400">
            <Cake className="h-10 w-10" strokeWidth={1.25} />
            <p className="text-sm">No birthdays this month</p>
          </div>
        ) : (
          birthdays.map((b) => (
            <div key={b.member_id} className="flex items-center gap-4 px-4 py-4 sm:px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <Cake className="h-5 w-5 text-amber-600" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-medium text-slate-900">{b.full_name}</p>
                <p className="text-sm text-slate-500">{month} {b.day}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
