// Core types for the equity modeling playground

export interface PlaygroundInvestor {
  id: string;
  name: string;
  type: 'individual' | 'entity';
  email?: string;
  // Temporary ID for playground mode - may not exist in backend
  isHypothetical?: boolean;
}

export interface PlaygroundShareClass {
  id: string;
  name: string;
  originalIssuePriceInDollars: number;
  liquidationPreferenceMultiple: number;
  participating: boolean;
  participationCapMultiple?: number;
  seniorityRank: number;
  preferred: boolean;
  // Temporary ID for playground mode
  isHypothetical?: boolean;
}

export interface PlaygroundShareHolding {
  id: string;
  investorId: string;
  shareClassId: string;
  numberOfShares: number;
  sharePriceUsd: number;
  totalAmountInCents: number;
  issuedAt: Date;
  // Temporary ID for playground mode
  isHypothetical?: boolean;
}

export interface PlaygroundScenario {
  id?: string;
  name: string;
  description?: string;
  exitAmountCents: bigint;
  exitDate: Date;
  status: 'draft' | 'saved';
}

export interface PlaygroundPayout {
  id: string;
  investorId: string;
  shareClassId: string;
  investorName: string;
  shareClassName: string;
  securityType: 'equity' | 'convertible';
  numberOfShares: number;
  payoutAmountCents: number;
  liquidationPreferenceAmount: number;
  participationAmount: number;
  commonProceedsAmount: number;
}

export interface PlaygroundEquityStructure {
  investors: PlaygroundInvestor[];
  shareClasses: PlaygroundShareClass[];
  shareHoldings: PlaygroundShareHolding[];
}

export interface PlaygroundState {
  // Current scenario being modeled
  scenario: PlaygroundScenario;
  
  // Equity structure (can be modified in playground)
  equityStructure: PlaygroundEquityStructure;
  
  // Calculated results
  payouts: PlaygroundPayout[];
  
  // UI state
  isCalculating: boolean;
  hasUnsavedChanges: boolean;
  comparisonScenarios: PlaygroundScenario[];
  
  // Original data from backend (for reset functionality)
  originalEquityStructure: PlaygroundEquityStructure;
}

export interface EquityCalculationInput {
  exitAmountCents: bigint;
  exitDate: Date;
  equityStructure: PlaygroundEquityStructure;
}

export interface EquityCalculationResult {
  payouts: PlaygroundPayout[];
  totalDistributed: number;
  calculationTime: number;
}