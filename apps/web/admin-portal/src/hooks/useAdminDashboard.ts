"use client";

import type { Member } from "@osaja/types";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { mapMember, type DashboardStats, type MemberListResponse } from "@/lib/types";

export function useAdminDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "dashboard"] as const,
    enabled,
    staleTime: 45_000,
    queryFn: async () => {
      const [statsRes, membersRes] = await Promise.all([
        apiFetch<DashboardStats>("/dashboard/stats"),
        apiFetch<MemberListResponse>("/members?page=1&page_size=5"),
      ]);
      return {
        stats: statsRes.data as DashboardStats,
        recentMembers: (membersRes.data?.items ?? []).map((raw) => mapMember(raw)) as Member[],
      };
    },
  });
}
