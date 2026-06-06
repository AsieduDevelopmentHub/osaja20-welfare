import type { Contribution, DuesSummary, Member, MemberVote } from "@osaja/types";
import { mapPreferences } from "./profile";

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
    emailVerified: Boolean(raw.email_verified),
    registrationDate: String(raw.registration_date ?? ""),
    avatarUrl: raw.avatar_url ? String(raw.avatar_url) : undefined,
    preferences: mapPreferences(raw.preferences as Record<string, unknown> | undefined),
  };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function mapDuesSummary(raw: Record<string, unknown>): DuesSummary {
  const currentMonth = raw.current_month as Record<string, unknown>;
  const periods = (raw.periods as Record<string, unknown>[]) ?? [];

  return {
    monthlyAmount: Number(raw.monthly_amount ?? 30),
    currency: String(raw.currency ?? "GHS"),
    balance: Number(raw.balance ?? 0),
    currentMonth: {
      year: Number(currentMonth?.year),
      month: Number(currentMonth?.month),
      label: String(currentMonth?.label ?? ""),
    },
    currentStatus: raw.current_status as DuesSummary["currentStatus"],
    arrearsCount: Number(raw.arrears_count ?? 0),
    totalOwed: Number(raw.total_owed ?? 0),
    totalPaidMonths: Number(raw.total_paid_months ?? 0),
    periods: periods.map((p) => ({
      year: Number(p.year),
      month: Number(p.month),
      label: String(p.label),
      amount: Number(p.amount),
      status: p.status as DuesSummary["periods"][0]["status"],
      paidAmount: Number(p.paid_amount ?? 0),
    })),
  };
}

export function mapContribution(raw: Record<string, unknown>): Contribution {
  return {
    id: String(raw.id),
    memberId: String(raw.member_id),
    amount: Number(raw.amount),
    type: raw.type as Contribution["type"],
    reference: String(raw.reference ?? ""),
    createdBy: String(raw.created_by),
    verifiedBy: raw.verified_by ? String(raw.verified_by) : undefined,
    createdAt: String(raw.created_at),
    periodYear: raw.period_year != null ? Number(raw.period_year) : undefined,
    periodMonth: raw.period_month != null ? Number(raw.period_month) : undefined,
    balance: raw.balance != null ? Number(raw.balance) : undefined,
  };
}

export function mapVote(raw: Record<string, unknown>): MemberVote {
  const options = (raw.options as Record<string, unknown>[]) ?? [];
  return {
    id: String(raw.id),
    title: String(raw.title),
    description: raw.description ? String(raw.description) : undefined,
    voteType: raw.vote_type as MemberVote["voteType"],
    status: raw.status as MemberVote["status"],
    opensAt: String(raw.opens_at),
    closesAt: String(raw.closes_at),
    minimumContribution: raw.minimum_contribution != null ? Number(raw.minimum_contribution) : undefined,
    executiveOnly: Boolean(raw.executive_only),
    options: options.map((o) => ({
      id: String(o.id),
      label: String(o.label),
    })),
    hasVoted: Boolean(raw.has_voted),
    votedOptionId: raw.voted_option_id ? String(raw.voted_option_id) : undefined,
  };
}

export interface ContributionListResponse {
  items: Contribution[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export function mapContributionList(raw: Record<string, unknown>): ContributionListResponse {
  const items = (raw.items as Record<string, unknown>[]) ?? [];
  return {
    items: items.map(mapContribution),
    total: Number(raw.total ?? 0),
    page: Number(raw.page ?? 1),
    page_size: Number(raw.page_size ?? 20),
    total_pages: Number(raw.total_pages ?? 1),
  };
}
