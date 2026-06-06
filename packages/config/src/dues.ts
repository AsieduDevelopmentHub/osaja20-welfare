/** Monthly welfare dues configuration — shared across member & admin apps */

export const DUES = {
  MONTHLY_AMOUNT: 30,
  CURRENCY: "GHS",
  /** First calendar month dues are expected (inclusive) */
  EFFECTIVE_FROM: { year: 2025, month: 1 },
  /** Day of month after which current month is considered overdue */
  DUE_DAY: 5,
} as const;

export const PAYMENT_INSTRUCTIONS = {
  title: "How to pay your dues",
  methods: [
    {
      id: "momo",
      label: "Mobile Money (MTN)",
      detail: "Send GHS 30 to the welfare MoMo number below. Use your Member ID as the reference.",
      number: "024 XXX XXXX",
      name: "OSAJA'20 Welfare Fund",
    },
    {
      id: "bank",
      label: "Bank transfer",
      detail: "Transfer to the welfare account. Share your receipt with the treasurer on WhatsApp.",
      accountName: "OSAJA'20 Welfare Fund",
      accountNumber: "XXXX-XXXX-XXXX",
      bank: "GCB Bank",
    },
  ],
  note: "After payment, the executive team will record it in the system within 24–48 hours. Contact the treasurer if your payment is not reflected.",
} as const;
