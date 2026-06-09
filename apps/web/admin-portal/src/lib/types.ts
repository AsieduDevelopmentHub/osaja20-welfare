import type { Member, UserRole, WelfareStatus } from "@osaja/types";

export function mapMember(raw: Record<string, unknown>): Member {
  return {
    id: String(raw.id),
    fullName: String(raw.full_name),
    username: String(raw.username ?? ""),
    email: String(raw.email),
    phoneNumber: String(raw.phone_number),
    dateOfBirth: String(raw.date_of_birth),
    membershipId: String(raw.membership_id),
    batch: Number(raw.batch),
    status: raw.status as Member["status"],
    role: raw.role as Member["role"],
    emailVerified: Boolean(raw.email_verified),
    registrationDate: String(raw.registration_date ?? ""),
    avatarUrl: raw.avatar_url ? String(raw.avatar_url) : undefined,
  };
}

export interface VoteResultsData {
  vote_id: string;
  vote_title: string;
  vote_status: string;
  total_votes: number;
  winner_option_id: string | null;
  winner_label: string | null;
  results: { option_id: string; label: string; count: number; percentage: number }[];
}

export interface DashboardStats {
  total_members: number;
  active_members: number;
  pending_welfare_cases: number;
  total_contributions: number;
  upcoming_birthdays_today: number;
  active_votes: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type MemberListResponse = PaginatedResponse<Record<string, unknown>>;

export interface WelfareCaseItem {
  id: string;
  member_id: string;
  member_name?: string;
  membership_id?: string;
  title: string;
  description: string;
  status: WelfareStatus;
  created_at: string;
  updated_at: string;
  available_transitions?: string[];
}

export interface VoteItem {
  id: string;
  title: string;
  description?: string;
  vote_type: string;
  status: string;
  opens_at: string;
  closes_at: string;
  minimum_contribution?: number;
  executive_only: boolean;
  results_published?: boolean;
  options: { id: string; label: string }[];
  submission_count?: number;
}

export interface ContributionItem {
  id: string;
  member_id: string;
  member_name?: string;
  membership_id?: string;
  amount: number;
  type: string;
  reference: string;
  period_year?: number;
  period_month?: number;
  created_at: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  target_audience: string[];
  published_at?: string;
  created_at: string;
}

export interface PaymentSettings {
  monthly_amount: number;
  currency: string;
  paystack_enabled: boolean;
  manual_payment_enabled: boolean;
  paystack_configured?: boolean;
  paystack_public_key?: string;
  title: string;
  note: string;
  momo_enabled: boolean;
  momo_label: string;
  momo_detail: string;
  momo_number: string;
  momo_account_name: string;
  bank_enabled: boolean;
  bank_label: string;
  bank_detail: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
}

export const EXECUTIVE_ROLES = new Set<UserRole>(["administrator", "executive"]);

export function isExecutiveRole(role?: UserRole | string): boolean {
  return role === "administrator" || role === "executive";
}

export function isAdministrator(role?: UserRole | string): boolean {
  return role === "administrator";
}

export const WELFARE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  allocated: "Support allocated",
  resolved: "Resolved",
  archived: "Archived",
};

export const VOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  result_published: "Results published",
  archived: "Archived",
};
