import type { Member, UserRole } from "@osaja/types";

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
  };
}

export interface DashboardStats {
  total_members: number;
  active_members: number;
  pending_welfare_cases: number;
  total_contributions: number;
  upcoming_birthdays_today: number;
  active_votes: number;
}

export interface MemberListResponse {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const EXECUTIVE_ROLES = new Set<UserRole>(["administrator", "executive"]);

export function isExecutiveRole(role?: UserRole | string): boolean {
  return role === "administrator" || role === "executive";
}
