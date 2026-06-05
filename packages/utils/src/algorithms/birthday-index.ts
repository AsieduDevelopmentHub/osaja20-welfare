/**
 * Birthday index using 366-day bucket arrays for O(1) birthday lookups.
 * Ignores year — suitable for monthly celebration calendars.
 */

export interface BirthdayMember {
  memberId: string;
  fullName: string;
  month: number;
  day: number;
}

export class BirthdayIndex {
  private buckets: Map<number, BirthdayMember[]> = new Map();

  private dayKey(month: number, day: number): number {
    return month * 100 + day;
  }

  insert(member: BirthdayMember): void {
    const key = this.dayKey(member.month, member.day);
    if (!this.buckets.has(key)) {
      this.buckets.set(key, []);
    }
    const bucket = this.buckets.get(key)!;
    const existing = bucket.findIndex((m) => m.memberId === member.memberId);
    if (existing >= 0) {
      bucket[existing] = member;
    } else {
      bucket.push(member);
    }
  }

  remove(memberId: string, month: number, day: number): void {
    const key = this.dayKey(month, day);
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    const filtered = bucket.filter((m) => m.memberId !== memberId);
    if (filtered.length === 0) {
      this.buckets.delete(key);
    } else {
      this.buckets.set(key, filtered);
    }
  }

  getBirthdaysForDate(month: number, day: number): BirthdayMember[] {
    return [...(this.buckets.get(this.dayKey(month, day)) ?? [])];
  }

  getBirthdaysForMonth(month: number): BirthdayMember[] {
    const results: BirthdayMember[] = [];
    for (const [key, members] of this.buckets) {
      if (Math.floor(key / 100) === month) {
        results.push(...members);
      }
    }
    return results.sort((a, b) => a.day - b.day);
  }

  getUpcoming(days: number, from: Date = new Date()): BirthdayMember[] {
    const results: BirthdayMember[] = [];
    const cursor = new Date(from);

    for (let i = 0; i < days; i++) {
      const month = cursor.getMonth() + 1;
      const day = cursor.getDate();
      results.push(...this.getBirthdaysForDate(month, day));
      cursor.setDate(cursor.getDate() + 1);
    }

    return results;
  }
}
