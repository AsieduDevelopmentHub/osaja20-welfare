"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    enabled,
    queryFn: async () => {
      const res = await apiFetch<{ count: number }>("/notifications/unread-count");
      return Number(res.data?.count ?? 0);
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
