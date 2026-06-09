/** Monthly welfare dues configuration — shared across member & admin apps */

export const DUES = {
  MONTHLY_AMOUNT: 30,
  CURRENCY: "GHS",
  /** First calendar month dues are expected (inclusive) */
  EFFECTIVE_FROM: { year: 2025, month: 1 },
} as const;
