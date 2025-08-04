export const DIVIDEND_ROUND_STATUS = {
  DRAFT: "DRAFT",
  PAYMENT_SCHEDULED: "PAYMENT_SCHEDULED",
  PAYMENT_IN_PROGRESS: "PAYMENT_IN_PROGRESS",
  PARTIALLY_COMPLETED: "PARTIALLY_COMPLETED",
  COMPLETED: "COMPLETED",
} as const;

type DividendRoundStatus = (typeof DIVIDEND_ROUND_STATUS)[keyof typeof DIVIDEND_ROUND_STATUS];

const MOCK_DIVIDEND_COMPUTATIONS = [
  {
    id: 1n,
    name: "Computation 1",
    issuedAt: new Date("2024-01-01"),
    totalAmountInUsd: 10000n,
    numberOfShareholders: 100n,
    returnOfCapital: false,
    dividendsIssuanceDate: new Date("2024-01-01"),
  },
];

const MOCK_DIVIDEND_ROUNDS = [
  {
    id: 1n,
    name: "Dividend Round 1",
    issuedAt: new Date("2024-01-01"),
    totalAmountInCents: 1000000n,
    numberOfShareholders: 100n,
    returnOfCapital: false,
    dividendsIssuanceDate: new Date("2024-01-01"),
    status: DIVIDEND_ROUND_STATUS.PAYMENT_SCHEDULED,
  },
  {
    id: 2n,
    name: "Dividend Round 2",
    issuedAt: new Date("2025-01-01"),
    totalAmountInCents: 1000000n,
    numberOfShareholders: 100n,
    returnOfCapital: true,
    dividendsIssuanceDate: new Date("2025-01-01"),
    status: DIVIDEND_ROUND_STATUS.PAYMENT_IN_PROGRESS,
  },
  {
    id: 3n,
    name: "Dividend Round 3",
    issuedAt: new Date("2026-01-01"),
    totalAmountInCents: 1000000n,
    numberOfShareholders: 100n,
    returnOfCapital: false,
    dividendsIssuanceDate: new Date("2026-01-01"),
    status: DIVIDEND_ROUND_STATUS.PARTIALLY_COMPLETED,
  },
  {
    id: 4n,
    name: "Dividend Round 4",
    issuedAt: new Date("2027-01-01"),
    totalAmountInCents: 1000000n,
    numberOfShareholders: 100n,
    returnOfCapital: false,
    dividendsIssuanceDate: new Date("2027-01-01"),
    status: DIVIDEND_ROUND_STATUS.COMPLETED,
  },
];

export type UnifiedDividendRound = {
  id: bigint;
  name: string;
  issuedAt: Date;
  totalAmountInCents: bigint;
  numberOfShareholders: bigint;
  returnOfCapital: boolean;
  dividendsIssuanceDate: Date;
  type: "round" | "draft_round";
  status: DividendRoundStatus;
};

export const unifiedData: UnifiedDividendRound[] = [
  ...MOCK_DIVIDEND_COMPUTATIONS.map((c) => ({
    ...c,
    type: "draft_round" as const,
    totalAmountInCents: c.totalAmountInUsd * 100n,
    status: DIVIDEND_ROUND_STATUS.DRAFT,
  })),
  ...MOCK_DIVIDEND_ROUNDS.map((r) => ({
    ...r,
    type: "round" as const,
  })),
];
