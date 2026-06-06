/** Shared domain types for OSAJA'20 Welfare Platform */

export type UserRole = "administrator" | "executive" | "member";

export type MemberStatus = "active" | "inactive" | "archived" | "pending";

export interface MemberPreferences {
  notifyDues: boolean;
  notifyVotes: boolean;
  notifyBirthdays: boolean;
  notifyAnnouncements: boolean;
  notifyWelfare: boolean;
  notifyCelebrations: boolean;
  emailDigest: boolean;
  compactDashboard: boolean;
}

export interface Member {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  membershipId: string;
  batch: number;
  registrationDate: string;
  status: MemberStatus;
  role?: UserRole;
  emailVerified: boolean;
  avatarUrl?: string;
  preferences?: MemberPreferences;
}

export type WelfareStatus =
  | "created"
  | "executive_review"
  | "approved"
  | "support_allocated"
  | "resolved"
  | "archived";

export interface WelfareCase {
  id: string;
  memberId: string;
  title: string;
  description: string;
  status: WelfareStatus;
  createdAt: string;
  updatedAt: string;
}

export type VoteType = "election" | "decision" | "multi_choice";

export type VoteLifecycle =
  | "draft"
  | "review"
  | "published"
  | "open"
  | "closed"
  | "verified"
  | "result_published"
  | "archived";

export type DecisionOption = "yes" | "no" | "abstain";

export interface Vote {
  id: string;
  title: string;
  description: string;
  voteType: VoteType;
  status: VoteLifecycle;
  opensAt: string;
  closesAt: string;
  options: VoteOption[];
}

export interface VoteOption {
  id: string;
  label: string;
  voteCount?: number;
}

export interface VoteSubmission {
  id: string;
  voteId: string;
  memberId: string;
  optionId: string;
  submittedAt: string;
  locked: boolean;
}

export type ContributionType = "dues" | "donation" | "welfare" | "other";

export interface Contribution {
  id: string;
  memberId: string;
  amount: number;
  type: ContributionType;
  reference: string;
  createdBy: string;
  verifiedBy?: string;
  createdAt: string;
  periodYear?: number;
  periodMonth?: number;
  balance?: number;
}

export type DuesPeriodStatus = "paid" | "due" | "overdue" | "upcoming";

export interface DuesPeriod {
  year: number;
  month: number;
  label: string;
  amount: number;
  status: DuesPeriodStatus;
  paidAmount: number;
}

export interface DuesSummary {
  monthlyAmount: number;
  currency: string;
  balance: number;
  currentMonth: { year: number; month: number; label: string };
  currentStatus: "paid" | "due" | "overdue";
  arrearsCount: number;
  totalOwed: number;
  totalPaidMonths: number;
  periods: DuesPeriod[];
}

export interface MemberVote {
  id: string;
  title: string;
  description?: string;
  voteType: VoteType;
  status: VoteLifecycle;
  opensAt: string;
  closesAt: string;
  minimumContribution?: number;
  executiveOnly: boolean;
  options: VoteOption[];
  hasVoted?: boolean;
  votedOptionId?: string;
}

export type NotificationType =
  | "meeting"
  | "welfare"
  | "announcement"
  | "contribution"
  | "celebration"
  | "voting";

export interface Notification {
  id: string;
  memberId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  scheduledAt?: string;
  sentAt?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: UserRole[] | "all";
  publishedAt?: string;
  scheduledAt?: string;
  archived: boolean;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  pendingWelfareCases: number;
  totalContributions: number;
  upcomingBirthdays: number;
  activeVotes: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
