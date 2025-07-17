// Core types for the client-side waterfall playground
// ALL terms are configurable in the UI

export interface PlaygroundInvestor {
  id: string;
  name: string;
  type: 'individual' | 'entity';
  email?: string;
  // Client-side metadata
  isHypothetical?: boolean;
  createdAt: Date;
  notes?: string;
}

export interface PlaygroundShareClass {
  id: string;
  name: string;
  preferred: boolean;
  originalIssuePriceInDollars: number;
  
  // ALL waterfall terms configurable
  liquidationPreferenceMultiple: number;
  participating: boolean;
  participationCapMultiple?: number;
  seniorityRank: number;
  
  // Client-side metadata
  isHypothetical?: boolean;
  color?: string; // For visualization
  description?: string;
}

export interface PlaygroundConvertibleSecurity {
  id: string;
  investorId: string;
  principalValueInCents: number;
  issuedAt: Date;
  impliedShares: number;
  
  // ALL convertible terms configurable
  valuationCapCents?: number;
  discountRatePercent?: number;
  interestRatePercent?: number;
  maturityDate?: Date;
  seniorityRank?: number;
  
  // Client-side metadata
  isHypothetical?: boolean;
  notes?: string;
}

export interface PlaygroundShareHolding {
  id: string;
  investorId: string;
  shareClassId: string;
  numberOfShares: number;
  sharePriceUsd: number;
  totalAmountInCents: number;
  issuedAt: Date;
  isHypothetical?: boolean;
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

export interface PlaygroundScenario {
  id?: string;
  name: string;
  description?: string;
  exitAmountCents: bigint;
  exitDate: Date;
  createdAt: Date;
}

export interface PlaygroundEquityStructure {
  investors: PlaygroundInvestor[];
  shareClasses: PlaygroundShareClass[];
  shareHoldings: PlaygroundShareHolding[];
  convertibleSecurities: PlaygroundConvertibleSecurity[];
}

export interface PlaygroundHistoryEntry {
  id: string;
  name: string;
  timestamp: Date;
  scenario: PlaygroundScenario;
  equityStructure: PlaygroundEquityStructure;
  payouts: PlaygroundPayout[];
}

export interface PlaygroundState {
  // Core entities - all configurable
  investors: PlaygroundInvestor[];
  shareClasses: PlaygroundShareClass[];
  shareHoldings: PlaygroundShareHolding[];
  convertibleSecurities: PlaygroundConvertibleSecurity[];
  
  // Current scenario
  scenario: PlaygroundScenario;
  
  // Calculated results
  payouts: PlaygroundPayout[];
  
  // UI state
  isCalculating: boolean;
  activeTab: 'configuration' | 'visualization';
  selectedInvestor?: string;
  selectedShareClass?: string;
  
  // History and comparison
  comparisonScenarios: PlaygroundScenario[];
  history: PlaygroundHistoryEntry[];
  
  // Configuration state
  hasUnsavedChanges: boolean;
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

export interface PlaygroundConfiguration {
  version: string;
  createdAt: Date;
  scenario: PlaygroundScenario;
  equityStructure: PlaygroundEquityStructure;
  metadata?: {
    description?: string;
    tags?: string[];
  };
}

// Share class presets
export interface ShareClassPreset {
  id: string;
  name: string;
  description: string;
  shareClass: Omit<PlaygroundShareClass, 'id' | 'name'>;
}

// Convertible security presets
export interface ConvertibleSecurityPreset {
  id: string;
  name: string;
  description: string;
  security: Omit<PlaygroundConvertibleSecurity, 'id' | 'investorId'>;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Export types
export interface ExportFormat {
  type: 'json' | 'csv' | 'pdf' | 'excel';
  options?: {
    includeMetadata?: boolean;
    includeCalculations?: boolean;
    dateFormat?: string;
  };
}