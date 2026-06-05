/**
 * Append-only contribution ledger with running balance validation.
 * Uses a hash map for O(1) balance lookups per member.
 */

export type LedgerEntryType = "credit" | "debit";

export interface LedgerEntry {
  id: string;
  memberId: string;
  amount: number;
  type: LedgerEntryType;
  reference: string;
  createdAt: Date;
  createdBy: string;
  verifiedBy?: string;
}

export class ContributionLedger {
  private entries: LedgerEntry[] = [];
  private balances = new Map<string, number>();
  private memberEntries = new Map<string, LedgerEntry[]>();

  private round(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  getBalance(memberId: string): number {
    return this.balances.get(memberId) ?? 0;
  }

  getEntries(memberId: string): readonly LedgerEntry[] {
    return this.memberEntries.get(memberId) ?? [];
  }

  getAllEntries(): readonly LedgerEntry[] {
    return this.entries;
  }

  append(entry: LedgerEntry): { success: boolean; error?: string } {
    if (entry.amount <= 0) {
      return { success: false, error: "Amount must be positive" };
    }

    const signedAmount = entry.type === "credit" ? entry.amount : -entry.amount;
    const newBalance = this.round((this.balances.get(entry.memberId) ?? 0) + signedAmount);

    if (entry.type === "debit" && newBalance < 0) {
      return { success: false, error: "Insufficient balance" };
    }

    this.entries.push(entry);
    this.balances.set(entry.memberId, newBalance);

    if (!this.memberEntries.has(entry.memberId)) {
      this.memberEntries.set(entry.memberId, []);
    }
    this.memberEntries.get(entry.memberId)!.push(entry);

    return { success: true };
  }

  reconcile(memberId: string): { valid: boolean; computed: number; stored: number } {
    const memberEntries = this.memberEntries.get(memberId) ?? [];
    const computed = this.round(
      memberEntries.reduce((sum, e) => {
        return sum + (e.type === "credit" ? e.amount : -e.amount);
      }, 0)
    );
    const stored = this.getBalance(memberId);
    return { valid: computed === stored, computed, stored };
  }

  getTotalContributions(): number {
    return this.round(
      [...this.balances.values()].reduce((sum, b) => sum + Math.max(0, b), 0)
    );
  }
}
