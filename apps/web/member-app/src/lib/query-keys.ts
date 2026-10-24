export const queryKeys = {
  unreadCount: ["notifications", "unread-count"] as const,
  notifications: ["notifications", "list"] as const,
  announcements: ["announcements"] as const,
  dues: ["dues", "me"] as const,
  contributions: (page: number) => ["contributions", "me", page] as const,
  paymentSettings: ["settings", "payment"] as const,
  voting: ["voting", "open"] as const,
  publishedResults: ["voting", "published-results"] as const,
  welfareMine: ["welfare", "me"] as const,
  birthdays: (month: number) => ["birthdays", month] as const,
  dashboard: ["dashboard", "member"] as const,
};
