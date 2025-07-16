export interface LiquidationScenario {
  id: string;
  externalId: string;
  name: string;
  description?: string;
  exitAmountCents: string;
  exitDate: string;
  status: "draft" | "final";
  createdAt: string;
  updatedAt: string;
}

export interface LiquidationPayout {
  id: string;
  investorName: string;
  shareClass?: string;
  securityType: "equity" | "convertible";
  numberOfShares?: string;
  payoutAmountCents: string;
  liquidationPreferenceAmount?: string;
  participationAmount?: string;
  commonProceedsAmount?: string;
}

export interface LiquidationScenarioWithPayouts extends LiquidationScenario {
  payouts: LiquidationPayout[];
}
