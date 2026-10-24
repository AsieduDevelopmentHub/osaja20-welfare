export const queryKeys = {
  unreadCount: ["notifications", "unread-count"] as const,
  notifications: ["notifications", "list"] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  recentMembers: ["members", "recent"] as const,
  members: (page: number, status: string, query: string) =>
    ["members", "list", { page, status, query }] as const,
  announcements: ["announcements"] as const,
  activity: (page: number, entityType: string, action: string) =>
    ["activity", { page, entityType, action }] as const,
  contributionsSummary: ["contributions", "summary"] as const,
  contributions: (params: string) => ["contributions", "list", params] as const,
  owing: (page: number) => ["contributions", "owing", page] as const,
  welfare: (status: string) => ["welfare", status] as const,
  voting: (status: string) => ["voting", "manage", status] as const,
  inquiries: (status: string) => ["inquiries", status] as const,
  birthdays: (month: number) => ["birthdays", month] as const,
  paymentSettings: ["settings", "payment"] as const,
};
