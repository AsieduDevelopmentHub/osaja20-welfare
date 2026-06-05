/**
 * Vote processing engine with hash-based duplicate detection
 * and efficient tally computation.
 */

import type { Member, VoteType } from "@osaja/types";

export type VoteValidationError =
  | "member_inactive"
  | "email_not_verified"
  | "duplicate_vote"
  | "vote_closed"
  | "vote_not_open"
  | "invalid_option"
  | "insufficient_contribution"
  | "executive_only";

export interface VoteEligibilityRules {
  requireEmailVerified?: boolean;
  minimumContribution?: number;
  executiveOnly?: boolean;
}

export interface VoteContext {
  voteId: string;
  voteType: VoteType;
  status: string;
  opensAt: Date;
  closesAt: Date;
  validOptionIds: Set<string>;
  eligibility?: VoteEligibilityRules;
}

export interface VoteResult {
  optionId: string;
  count: number;
  percentage: number;
}

export class VoteEngine {
  private submissions = new Map<string, Set<string>>();
  private tallies = new Map<string, Map<string, number>>();

  private submissionKey(voteId: string, memberId: string): string {
    return `${voteId}:${memberId}`;
  }

  validateSubmission(
    member: Member,
    context: VoteContext,
    optionId: string,
    now: Date = new Date(),
    memberContributionTotal = 0,
    isExecutive = false
  ): VoteValidationError | null {
    if (member.status !== "active") return "member_inactive";

    const rules = context.eligibility ?? {};
    if (rules.requireEmailVerified !== false && !member.emailVerified) {
      return "email_not_verified";
    }

    if (rules.executiveOnly && !isExecutive) return "executive_only";

    if (
      rules.minimumContribution !== undefined &&
      memberContributionTotal < rules.minimumContribution
    ) {
      return "insufficient_contribution";
    }

    if (context.status !== "open") return "vote_not_open";
    if (now < context.opensAt) return "vote_not_open";
    if (now > context.closesAt) return "vote_closed";
    if (!context.validOptionIds.has(optionId)) return "invalid_option";

    const voteSubmissions = this.submissions.get(context.voteId) ?? new Set();
    if (voteSubmissions.has(member.id)) return "duplicate_vote";

    return null;
  }

  submitVote(voteId: string, memberId: string, optionId: string): boolean {
    const key = this.submissionKey(voteId, memberId);
    if (this.submissions.get(voteId)?.has(memberId)) return false;

    if (!this.submissions.has(voteId)) {
      this.submissions.set(voteId, new Set());
    }
    this.submissions.get(voteId)!.add(memberId);

    if (!this.tallies.has(voteId)) {
      this.tallies.set(voteId, new Map());
    }
    const voteTally = this.tallies.get(voteId)!;
    voteTally.set(optionId, (voteTally.get(optionId) ?? 0) + 1);

    return true;
  }

  hasVoted(voteId: string, memberId: string): boolean {
    return this.submissions.get(voteId)?.has(memberId) ?? false;
  }

  calculateResults(voteId: string, optionIds: string[]): VoteResult[] {
    const voteTally = this.tallies.get(voteId) ?? new Map();
    const total = [...voteTally.values()].reduce((sum, c) => sum + c, 0);

    return optionIds
      .map((optionId) => ({
        optionId,
        count: voteTally.get(optionId) ?? 0,
        percentage: total > 0 ? ((voteTally.get(optionId) ?? 0) / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  getWinner(voteId: string, optionIds: string[]): string | null {
    const results = this.calculateResults(voteId, optionIds);
    if (results.length === 0 || results[0].count === 0) return null;

    const topCount = results[0].count;
    const tied = results.filter((r) => r.count === topCount);
    if (tied.length > 1) return null;

    return results[0].optionId;
  }

  getTotalVotes(voteId: string): number {
    return this.submissions.get(voteId)?.size ?? 0;
  }

  reset(voteId: string): void {
    this.submissions.delete(voteId);
    this.tallies.delete(voteId);
  }
}
