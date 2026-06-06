"use client";

import { formatCurrency } from "@osaja/utils";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function ContributionsPage() {
  const { member } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!member) return;
    apiFetch<{ balance: number }>(`/members/${member.id}/balance`)
      .then((r) => setBalance(r.data?.balance ?? 0))
      .catch(() => setBalance(0));
  }, [member]);

  return (
    <div>
      <PageHeader title="Contributions" description="Your contribution history and balance." />
      <div className="glass-card flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
          <Wallet className="h-6 w-6 text-green-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-sm text-slate-500">Current balance</p>
          <p className="text-2xl font-bold text-slate-900">
            {balance === null ? "—" : formatCurrency(balance)}
          </p>
        </div>
      </div>
    </div>
  );
}
