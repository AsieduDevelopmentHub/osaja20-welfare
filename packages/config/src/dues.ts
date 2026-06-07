/** Monthly welfare dues configuration — shared across member & admin apps */

export const DUES = {
  MONTHLY_AMOUNT: 30,
  CURRENCY: "GHS",
  /** First calendar month dues are expected (inclusive) */
  EFFECTIVE_FROM: { year: 2025, month: 1 },
  /** Day of month after which current month is considered overdue */
  DUE_DAY: 5,
} as const;
