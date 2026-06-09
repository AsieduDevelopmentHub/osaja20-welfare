"use client";

import { ListRowsSkeleton } from "@osaja/ui";
import { Cake, Gift, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { apiFetch } from "@/lib/api";
import { resolveAvatarUrl } from "@/lib/avatars";

interface Birthday {
  member_id: string;
  full_name: string;
  day: number;
  avatar_url?: string | null;
  membership_id?: string;
}

export default function AdminBirthdaysPage() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const month = new Date().getMonth() + 1;
  const monthLabel = new Date().toLocaleString("en-GH", { month: "long" });
  const today = new Date().getDate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Birthday[]>(`/dashboard/birthdays?month=${month}`);
      setBirthdays((res.data as Birthday[]) ?? []);
    } catch {
      setBirthdays([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const runBirthdayScan = async () => {
    setScanning(true);
    setMessage("");
    try {
      const res = await apiFetch<{ created: number }>("/notifications/scan-birthdays", { method: "POST" });
      const n = (res.data as { created?: number })?.created ?? 0;
      setMessage(n > 0 ? `Sent ${n} birthday notification(s) to members.` : "No new birthday notifications today.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Birthday scan failed");
    } finally {
      setScanning(false);
    }
  };

  const sorted = [...birthdays].sort((a, b) => a.day - b.day);
  const todayBirthdays = sorted.filter((b) => b.day === today);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Birthdays"
        description={`Members celebrating in ${monthLabel}. Notify all members when someone has a birthday today.`}
        action={
          <button
            type="button"
            onClick={runBirthdayScan}
            disabled={scanning}
            className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy-dark disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            Run birthday scan
          </button>
        }
      />

      {message ? (
        <div className="rounded-xl border border-white/10 bg-brand-navy/60 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      ) : null}

      {todayBirthdays.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-gold">Today</h2>
          {todayBirthdays.map((b) => (
            <BirthdayCard key={b.member_id} person={b} highlight />
          ))}
        </div>
      ) : null}

      {loading ? (
        <ListRowsSkeleton rows={6} variant="dark" />
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-brand-navy/60 p-10 text-center text-slate-400">
          <Cake className="mx-auto h-10 w-10" strokeWidth={1.25} />
          <p className="mt-2 text-sm">No birthdays this month.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">All in {monthLabel}</h2>
          <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-brand-navy/60">
            {sorted.map((b) => (
              <BirthdayRow key={b.member_id} person={b} isToday={b.day === today} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BirthdayCard({ person, highlight = false }: { person: Birthday; highlight?: boolean }) {
  const avatar = resolveAvatarUrl(person.avatar_url);
  return (
    <Link
      href={`/profile/${person.member_id}`}
      className={`flex items-center gap-4 rounded-2xl border p-4 transition hover:opacity-90 ${
        highlight
          ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-brand-gold/5"
          : "border-white/10 bg-brand-navy/60"
      }`}
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-brand-gold/30" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold">
          <Gift className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">{person.full_name}</p>
        <p className="text-sm text-slate-400">
          {highlight ? "Birthday today" : `Day ${person.day}`}
          {person.membership_id ? ` · ${person.membership_id}` : ""}
        </p>
      </div>
    </Link>
  );
}

function BirthdayRow({ person, isToday }: { person: Birthday; isToday: boolean }) {
  const avatar = resolveAvatarUrl(person.avatar_url);
  return (
    <Link
      href={`/profile/${person.member_id}`}
      className={`flex items-center gap-3 px-4 py-3 transition hover:bg-white/5 sm:px-5 ${
        isToday ? "bg-amber-500/5" : ""
      }`}
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-400">
          <Cake className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{person.full_name}</p>
        <p className="text-xs text-slate-500">{person.membership_id}</p>
      </div>
      <span className={`text-sm tabular-nums ${isToday ? "font-semibold text-brand-gold" : "text-slate-400"}`}>
        {isToday ? "Today" : `Day ${person.day}`}
      </span>
    </Link>
  );
}
