export { MemberSearchTrie } from "./algorithms/trie.js";
export { VoteEngine } from "./algorithms/vote-engine.js";
export type { VoteContext, VoteEligibilityRules, VoteResult, VoteValidationError } from "./algorithms/vote-engine.js";
export { ContributionLedger } from "./algorithms/ledger.js";
export type { LedgerEntry, LedgerEntryType } from "./algorithms/ledger.js";
export { WelfareStateMachine } from "./algorithms/state-machine.js";
export { PriorityQueue } from "./algorithms/priority-queue.js";
export type { ScheduledItem } from "./algorithms/priority-queue.js";
export { BirthdayIndex } from "./algorithms/birthday-index.js";
export type { BirthdayMember } from "./algorithms/birthday-index.js";

export function formatCurrency(amount: number, currency = "GHS"): string {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export { computeDuesSummary, periodLabel } from "./dues.js";
export type { DuesSummary, DuesPeriod, DuesPeriodStatus, PaidPeriodInput } from "./dues.js";

export { parseWhatsAppNumbers, formatPhoneDisplay, whatsAppUrl } from "./contact.js";
