/** Mirrors packages/config/src/dues.ts — keep values in sync */

const DUES = {
  MONTHLY_AMOUNT: 30,
  CURRENCY: "GHS",
  EFFECTIVE_FROM: { year: 2025, month: 1 },
} as const;

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
  currentMonth: { year: number; month: number; label: string };
  currentStatus: "paid" | "due" | "overdue";
  arrearsCount: number;
  totalOwed: number;
  totalPaidMonths: number;
  periods: DuesPeriod[];
}

export interface PaidPeriodInput {
  year: number;
  month: number;
  amount: number;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function periodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function comparePeriod(a: { year: number; month: number }, b: { year: number; month: number }): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function iterDuePeriods(
  memberSince: { year: number; month: number },
  asOf: { year: number; month: number }
): Array<{ year: number; month: number }> {
  const start = comparePeriod(memberSince, DUES.EFFECTIVE_FROM) > 0 ? memberSince : DUES.EFFECTIVE_FROM;
  const periods: Array<{ year: number; month: number }> = [];
  let cur = { ...start };
  while (comparePeriod(cur, asOf) <= 0) {
    periods.push({ ...cur });
    cur = addMonths(cur.year, cur.month, 1);
  }
  return periods;
}

export function computeDuesSummary(
  memberSince: Date | string,
  paidPeriods: PaidPeriodInput[],
  asOf: Date = new Date(),
  monthlyAmount: number = DUES.MONTHLY_AMOUNT
): DuesSummary {
  const since = typeof memberSince === "string" ? new Date(memberSince) : memberSince;
  const memberStart = { year: since.getFullYear(), month: since.getMonth() + 1 };
  const current = { year: asOf.getFullYear(), month: asOf.getMonth() + 1 };

  const paidMap = new Map<string, number>();
  for (const p of paidPeriods) {
    const key = periodKey(p.year, p.month);
    paidMap.set(key, (paidMap.get(key) ?? 0) + p.amount);
  }

  const duePeriods = iterDuePeriods(memberStart, current);

  let arrearsCount = 0;
  let totalOwed = 0;
  let totalPaidMonths = 0;

  const periods: DuesPeriod[] = duePeriods.map(({ year, month }) => {
    const paidAmount = paidMap.get(periodKey(year, month)) ?? 0;
    const isPaid = paidAmount >= monthlyAmount;
    const isCurrent = year === current.year && month === current.month;
    const isFuture = comparePeriod({ year, month }, current) > 0;
    const isPast = comparePeriod({ year, month }, current) < 0;

    let status: DuesPeriodStatus;
    if (isPaid) {
      status = "paid";
      totalPaidMonths += 1;
    } else if (isFuture) {
      status = "upcoming";
    } else if (isCurrent) {
      status = "due";
    } else {
      status = "overdue";
      if (isPast) {
        arrearsCount += 1;
        totalOwed += monthlyAmount - paidAmount;
      }
    }

    return {
      year,
      month,
      label: periodLabel(year, month),
      amount: monthlyAmount,
      status,
      paidAmount,
    };
  });

  const currentPeriod = periods.find((p) => p.year === current.year && p.month === current.month);
  let currentStatus: "paid" | "due" | "overdue" = "due";
  if (currentPeriod?.status === "paid") currentStatus = "paid";
  else if (currentPeriod?.status === "overdue") currentStatus = "overdue";

  return {
    monthlyAmount,
    currency: DUES.CURRENCY,
    currentMonth: { ...current, label: periodLabel(current.year, current.month) },
    currentStatus,
    arrearsCount,
    totalOwed,
    totalPaidMonths,
    periods,
  };
}
