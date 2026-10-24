"use client";

import type { Contribution, DuesSummary, WelfareCase, WelfareStatus } from "@osaja/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublishedVoteResult } from "@/components/VoteResultsCard";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { mapContribution, mapDuesSummary, type NotificationItem } from "@/lib/types";

export interface MemberDashboardData {
  dues: DuesSummary | null;
  unread: number;
  notifications: NotificationItem[];
  birthdays: number;
  activeVotes: number;
  recentPayments: Contribution[];
  welfareCases: WelfareCase[];
  voteResults: PublishedVoteResult[];
}

export function useMemberDashboard(enabled: boolean, compact: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...queryKeys.dashboard, compact ? "compact" : "full"] as const,
    enabled,
    staleTime: 45_000,
    queryFn: async (): Promise<MemberDashboardData> => {
      const month = new Date().getMonth() + 1;
      const notifLimit = compact ? 2 : 4;
      const welfareLimit = compact ? 2 : 3;
      const paymentLimit = compact ? 2 : 3;
      const resultsLimit = compact ? 1 : 2;

      const [duesRes, unreadRes, notifRes, birthdaysRes, votesRes, contribRes, welfareRes, resultsRes] =
        await Promise.all([
          apiFetch<Record<string, unknown>>("/members/me/dues"),
          apiFetch<{ count: number }>("/notifications/unread-count"),
          apiFetch<NotificationItem[]>("/notifications?unread_only=false"),
          apiFetch<{ day: number }[]>(`/dashboard/birthdays?month=${month}`),
          apiFetch<Record<string, unknown>[]>("/voting"),
          apiFetch<{ items: Record<string, unknown>[] }>(
            `/members/me/contributions?page=1&page_size=${paymentLimit}`
          ),
          apiFetch<{ items: Record<string, unknown>[] }>(
            `/welfare/me/cases?page=1&page_size=${welfareLimit}`
          ),
          apiFetch<PublishedVoteResult[]>("/voting/published-results"),
        ]);

      const wItems = welfareRes.data?.items ?? [];
      const unread = unreadRes.data?.count ?? 0;
      // Keep bell badge in sync without a second round-trip
      queryClient.setQueryData(queryKeys.unreadCount, unread);

      return {
        dues: duesRes.data ? mapDuesSummary(duesRes.data as Record<string, unknown>) : null,
        unread,
        notifications: (notifRes.data as NotificationItem[])?.slice(0, notifLimit) ?? [],
        birthdays: Array.isArray(birthdaysRes.data) ? birthdaysRes.data.length : 0,
        activeVotes: Array.isArray(votesRes.data) ? votesRes.data.length : 0,
        recentPayments: ((contribRes.data?.items ?? []) as Record<string, unknown>[]).map(mapContribution),
        welfareCases: wItems.map((raw) => ({
          id: String(raw.id),
          memberId: String(raw.member_id),
          title: String(raw.title),
          description: String(raw.description),
          status: raw.status as WelfareStatus,
          createdAt: String(raw.created_at),
          updatedAt: String(raw.updated_at),
        })),
        voteResults: (resultsRes.data ?? []).slice(0, resultsLimit),
      };
    },
  });
}
