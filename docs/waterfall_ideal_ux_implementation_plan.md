# Liquidation Waterfall - Ideal UX Implementation Plan

## Executive Summary

This document outlines the detailed implementation plan to evolve our current liquidation waterfall foundation into a world-class interactive modeling experience that surpasses competitors like Carta, Pulley, and Ledgy.

### Current State
- ✅ Client-side calculation engine with real-time updates
- ✅ Interactive waterfall chart with color-coded share classes
- ✅ Basic exit amount slider with live recalculation
- ✅ Save/reset functionality and detailed breakdown tables

### Target State
A comprehensive 7-zone interface matching the ideal UX breakdown:
1. **Scenario Header** - Context and controls
2. **Stacked Waterfall Chart** - Visual centerpiece
3. **Breakpoint & Sensitivity Panel** - Advanced analytics
4. **Detail Table Drawer** - Auditable numbers
5. **Term Controls** - Dynamic preference adjustments
6. **Scenario Manager** - Save, compare, share
7. **Audit & Export** - Trust and compliance features

---

## Phase 1: Enhanced Core UX (Week 1)

### 1.1 Zone 1: Scenario Header Enhancement

#### 1.1.1 Log-Scaled Exit Amount Slider
**Current**: Linear slider with limited range usability
**Target**: Log-scaled slider for intuitive navigation across wide valuation ranges

```typescript
// New component: LogScaleSlider
interface LogScaleSliderProps {
  value: number;
  min: number; // e.g., 100K
  max: number; // e.g., 10B
  onChange: (value: number) => void;
  presets: number[]; // [1M, 10M, 50M, 100M, 500M]
}

// Implementation strategy:
// - Use logarithmic transformation for smooth scaling
// - Visual tick marks at major intervals (1M, 10M, 100M, 1B)
// - Snap-to-preset functionality
// - Keyboard navigation support
```

**Files to modify:**
- `components/ExitAmountControl.tsx` - Replace linear slider
- `lib/equity-modeling/utils.ts` - Add log scale utilities

#### 1.1.2 Persistent Context Display
**Target**: Always-visible scenario metadata and totals

```typescript
// New component: ScenarioHeader
interface ScenarioHeaderProps {
  scenario: PlaygroundScenario;
  exitAmountCents: bigint;
  totalDistributed: number;
  undistributed: number;
  capTableDate: Date;
  onExitAmountChange: (amount: bigint) => void;
}

// Layout:
// [Scenario Name v2.1] [Exit: $50M ▼] [Distributed: $48M] [Remaining: $2M] [Actions]
```

**Files to create:**
- `components/ScenarioHeader.tsx`
- `components/UndistributedTracker.tsx`

#### 1.1.3 Quick Preset Buttons
**Target**: One-click access to common valuation scenarios

```typescript
const COMMON_PRESETS = [
  { label: '$1M (Acquihire)', value: 1_000_000 },
  { label: '$10M (Small Exit)', value: 10_000_000 },
  { label: '$50M (Good Exit)', value: 50_000_000 },
  { label: '$100M (Great Exit)', value: 100_000_000 },
  { label: '$500M (Unicorn)', value: 500_000_000 },
];
```

### 1.2 Zone 2: Waterfall Chart Evolution

#### 1.2.1 Cumulative Total Display
**Current**: Individual payout amounts only
**Target**: Running totals showing cumulative distribution

```typescript
interface WaterfallSegment {
  payout: PlaygroundPayout;
  cumulativeTotal: number; // New field
  remainingAfter: number;  // New field
  startY: number;
  height: number;
  color: string;
}

// Visual enhancement:
// - Right-side running total labels
// - Connecting lines showing flow
// - Percentage of total exit amount
```

#### 1.2.2 Undistributed Amount Banner
**Target**: Persistent visual indicator of remaining cash

```typescript
// Enhanced WaterfallChart with undistributed tracking
const UndistributedBanner: React.FC<{
  amount: number;
  percentage: number;
  totalExit: number;
}> = ({ amount, percentage, totalExit }) => (
  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
    <div className="flex justify-between items-center">
      <span className="text-yellow-800 font-medium">Undistributed</span>
      <span className="text-yellow-900 font-bold">
        {formatMoney(amount)} ({percentage.toFixed(1)}%)
      </span>
    </div>
    <div className="text-xs text-yellow-700 mt-1">
      Remaining from {formatMoney(totalExit)} exit
    </div>
  </div>
);
```

#### 1.2.3 Click-to-Drill Functionality
**Target**: Click any share class band to see individual holder breakdown

```typescript
interface DrillDownModal {
  shareClass: PlaygroundShareClass;
  holders: Array<{
    investor: PlaygroundInvestor;
    shares: number;
    payout: number;
    percentage: number;
  }>;
  onClose: () => void;
}

// Modal showing:
// - Individual holder allocations within the share class
// - Sorting by payout amount, share count, percentage
// - Mini-chart showing holder distribution
```

**Files to modify:**
- `components/WaterfallChart.tsx` - Add click handlers and drill-down
- `components/DrillDownModal.tsx` - New component

---

## Phase 2: Advanced Analytics (Week 2)

### 2.1 Zone 3: Breakpoint & Sensitivity Panel

#### 2.1.1 Automatic Breakpoint Detection
**Target**: Calculate and display valuation thresholds where waterfall behavior changes

```typescript
interface BreakpointAnalysis {
  detectBreakpoints(equityStructure: PlaygroundEquityStructure): Breakpoint[];
}

interface Breakpoint {
  valuation: number;
  description: string;
  type: 'preference_satisfied' | 'participation_starts' | 'cap_reached';
  affectedShareClass: string;
  beforePayout: number;
  afterPayout: number;
}

// Example breakpoints:
// - $8M: Series B preference fully satisfied
// - $9.5M: Series A preference fully satisfied, participation begins
// - $25M: Series A participation cap reached
```

#### 2.1.2 Mini Sensitivity Chart
**Target**: Line graph showing how each share class payout changes with exit amount

```typescript
interface SensitivityChart {
  shareClasses: PlaygroundShareClass[];
  valuationRange: [number, number];
  dataPoints: Array<{
    valuation: number;
    payouts: Record<string, number>; // shareClassId -> payout
  }>;
}

// Chart features:
// - Hover to see exact values
// - Toggle share classes on/off
// - Highlight current valuation
// - Show breakpoint markers
```

**Files to create:**
- `lib/equity-modeling/breakpoint-analyzer.ts`
- `components/BreakpointPanel.tsx`
- `components/SensitivityChart.tsx`

#### 2.1.3 Participation Cliff Indicators
**Target**: Visual markers showing where participation caps activate

```typescript
interface ParticipationCliff {
  shareClassId: string;
  shareClassName: string;
  capValuation: number;
  maxPayout: number;
  description: string;
}

// Visual indicators:
// - Warning icons on chart at cliff points
// - Tooltip explaining the cap effect
// - Table showing all active caps
```

### 2.2 Zone 4: Detail Table Drawer

#### 2.2.1 Enhanced Detail Table
**Current**: Basic payout breakdown
**Target**: Comprehensive analysis with IRR, fully-diluted %, and advanced sorting

```typescript
interface EnhancedPayoutData extends PlaygroundPayout {
  fullyDilutedPercentage: number;
  irr?: number; // If investment date available
  multipleOfMoney?: number; // Payout / Investment
  investmentDate?: Date;
  originalInvestment?: number;
}

// Table columns:
// - Investor Name
// - Share Class
// - Shares (#)
// - Ownership (%)
// - Investment ($)
// - Payout ($)
// - Multiple (x)
// - IRR (%)
// - Preference ($)
// - Participation ($)
// - Common ($)
```

#### 2.2.2 Smart Filtering & Sorting
**Target**: Advanced table controls for data analysis

```typescript
interface TableFilters {
  shareClasses: string[];
  investorTypes: ('individual' | 'entity')[];
  payoutRange: [number, number];
  irrRange?: [number, number];
  multipleRange?: [number, number];
}

interface TableSorting {
  column: string;
  direction: 'asc' | 'desc';
  secondarySort?: {
    column: string;
    direction: 'asc' | 'desc';
  };
}
```

#### 2.2.3 Export Functionality
**Target**: Professional-grade export options

```typescript
interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeCharts: boolean;
  includeBreakpoints: boolean;
  includeSensitivity: boolean;
  template: 'detailed' | 'summary' | 'board_presentation';
}

// Export features:
// - Formatted Excel with charts and formulas
// - PDF with waterfall visualization
// - CSV for analysis in other tools
// - Board presentation template
```

**Files to create:**
- `components/EnhancedDetailTable.tsx`
- `lib/equity-modeling/irr-calculator.ts`
- `lib/export/excel-generator.ts`
- `lib/export/pdf-generator.ts`

---

## Phase 3: Power User Features (Week 3)

### 3.1 Zone 5: Term Controls Panel

#### 3.1.1 Dynamic Preference Controls
**Target**: Real-time adjustment of liquidation preferences without backend changes

```typescript
interface TermControls {
  shareClassId: string;
  controls: {
    liquidationPreference: {
      current: number;
      options: [0, 1, 2, 3, 4, 5];
      onChange: (value: number) => void;
    };
    participating: {
      current: boolean;
      onChange: (value: boolean) => void;
    };
    participationCap?: {
      current: number;
      options: [1, 2, 3, 4, 5, 'unlimited'];
      onChange: (value: number | null) => void;
    };
    seniorityRank: {
      current: number;
      onChange: (value: number) => void;
    };
  };
}

// UI design:
// - Collapsible panels per share class
// - Toggle switches for participation
// - Dropdowns for preference multiples
// - Drag-and-drop for seniority ranking
```

#### 3.1.2 Option Pool Treatment
**Target**: Toggle between including/excluding unexercised options

```typescript
interface OptionPoolControls {
  treatAsExercised: boolean;
  poolSize: number;
  exercisePrice: number;
  impliedShares: number;
  onToggle: (exercised: boolean) => void;
}

// Effects on calculation:
// - If treated as exercised: adds to total share count
// - If not exercised: excluded from waterfall
// - Visual indicator of dilution impact
```

#### 3.1.3 SAFE/Convertible Controls
**Target**: Dynamic adjustment of conversion terms

```typescript
interface ConvertibleControls {
  securityId: string;
  controls: {
    valuationCap: number;
    discount: number;
    conversionTrigger: 'automatic' | 'optional';
    treatAsConverted: boolean;
  };
  onChange: (updates: Partial<ConvertibleControls['controls']>) => void;
}
```

**Files to create:**
- `components/TermControlsPanel.tsx`
- `components/ShareClassControls.tsx`
- `components/OptionPoolControls.tsx`
- `components/ConvertibleControls.tsx`
- `lib/equity-modeling/term-modifier.ts`

### 3.2 Zone 6: Scenario Manager

#### 3.2.1 Scenario Library
**Target**: Save, organize, and manage multiple scenarios

```typescript
interface ScenarioLibrary {
  scenarios: SavedScenario[];
  folders: ScenarioFolder[];
  templates: ScenarioTemplate[];
}

interface SavedScenario {
  id: string;
  name: string;
  version: number;
  parentId?: string; // For versioning
  exitAmount: number;
  termModifications: TermModification[];
  createdAt: Date;
  createdBy: string;
  tags: string[];
  notes?: string;
}

interface ScenarioFolder {
  id: string;
  name: string;
  scenarios: string[];
  color?: string;
}

// Features:
// - Drag-and-drop organization
// - Version history tracking
// - Tagging and search
// - Quick preview on hover
```

#### 3.2.2 Scenario Diff View
**Target**: Side-by-side comparison of scenarios with highlighting

```typescript
interface ScenarioDiff {
  baseScenario: SavedScenario;
  compareScenario: SavedScenario;
  differences: {
    exitAmount: { base: number; compare: number; };
    termChanges: TermModification[];
    payoutDifferences: Array<{
      investor: string;
      basePayout: number;
      comparePayout: number;
      difference: number;
      percentChange: number;
    }>;
  };
}

// Visual design:
// - Split screen with two waterfall charts
// - Highlighting of changed values
// - Summary of key differences
// - Export comparison report
```

#### 3.2.3 Share Links
**Target**: Generate read-only URLs for external sharing

```typescript
interface ShareLink {
  id: string;
  scenarioId: string;
  accessLevel: 'view' | 'comment';
  expiresAt?: Date;
  password?: string;
  allowedEmails?: string[];
  url: string;
}

// Features:
// - Password protection
// - Expiration dates
// - Email restrictions
// - View-only mode with watermarks
// - Comment functionality for feedback
```

**Files to create:**
- `components/ScenarioLibrary.tsx`
- `components/ScenarioDiffView.tsx`
- `components/ShareLinkModal.tsx`
- `lib/equity-modeling/scenario-manager.ts`
- `lib/sharing/link-generator.ts`

---

## Phase 4: Trust & Compliance (Week 4)

### 4.1 Zone 7: Audit & Export

#### 4.1.1 "Show Math" Feature
**Target**: Complete transparency of calculation methodology

```typescript
interface CalculationAuditTrail {
  payoutId: string;
  steps: CalculationStep[];
  inputs: {
    exitAmount: number;
    shareCount: number;
    shareClass: PlaygroundShareClass;
    seniorityRank: number;
  };
  output: {
    totalPayout: number;
    breakdown: PayoutBreakdown;
  };
}

interface CalculationStep {
  stepNumber: number;
  operation: string;
  formula: string;
  inputs: Record<string, number>;
  result: number;
  explanation: string;
}

// Example audit trail:
// Step 1: Calculate liquidation preference
//   Formula: shares × originalPrice × preferenceMultiple
//   Inputs: 1,000,000 × $1.00 × 1.0x
//   Result: $1,000,000
//   Explanation: Series A liquidation preference amount

// Step 2: Check available funds for preference
//   Formula: min(preferenceAmount, remainingFunds)
//   Inputs: min($1,000,000, $12,000,000)
//   Result: $1,000,000
//   Explanation: Full preference satisfied
```

#### 4.1.2 Board Deck Export
**Target**: One-click generation of presentation-ready materials

```typescript
interface BoardDeckExport {
  scenario: SavedScenario;
  sections: {
    executiveSummary: boolean;
    waterfallChart: boolean;
    breakpointAnalysis: boolean;
    sensitivityAnalysis: boolean;
    detailTables: boolean;
    scenarioComparison: boolean;
    appendix: boolean;
  };
  template: 'standard' | 'detailed' | 'summary';
  branding: {
    logo?: string;
    companyName: string;
    colors: {
      primary: string;
      secondary: string;
    };
  };
}

// Generated slides:
// 1. Executive Summary
// 2. Waterfall Overview
// 3. Key Breakpoints
// 4. Sensitivity Analysis
// 5. Detailed Breakdown
// 6. Scenario Comparison
// 7. Appendix (Assumptions & Methodology)
```

#### 4.1.3 Excel Model Export
**Target**: Complete working Excel model with formulas

```typescript
interface ExcelModelExport {
  workbook: {
    summary: WorksheetData;
    inputs: WorksheetData;
    calculations: WorksheetData;
    outputs: WorksheetData;
    charts: WorksheetData;
    scenarios: WorksheetData;
  };
  preserveFormulas: boolean;
  includeValidation: boolean;
  protectStructure: boolean;
}

// Worksheet structure:
// - Inputs: All assumption parameters
// - Calculations: Step-by-step waterfall logic
// - Outputs: Results summary and charts
// - Scenarios: Multiple scenario comparison
// - Summary: Executive dashboard
```

**Files to create:**
- `components/AuditTrailModal.tsx`
- `lib/audit/calculation-tracer.ts`
- `lib/export/board-deck-generator.ts`
- `lib/export/excel-model-builder.ts`
- `lib/export/pdf-presenter.ts`

---

## Technical Architecture Enhancements

### Enhanced State Management

```typescript
// Extended Zustand store with new capabilities
interface EnhancedEquityPlaygroundStore extends EquityPlaygroundStore {
  // Breakpoint analysis
  breakpoints: Breakpoint[];
  sensitivityData: SensitivityDataPoint[];
  
  // Term modifications
  termModifications: TermModification[];
  applyTermModification: (modification: TermModification) => void;
  resetTermModifications: () => void;
  
  // Scenario management
  savedScenarios: SavedScenario[];
  currentComparison?: ScenarioDiff;
  saveScenario: (name: string, notes?: string) => Promise<SavedScenario>;
  loadScenario: (id: string) => Promise<void>;
  compareScenarios: (baseId: string, compareId: string) => void;
  
  // Audit trail
  auditTrail: CalculationAuditTrail[];
  enableAuditMode: (enabled: boolean) => void;
  
  // Performance optimization
  calculationCache: Map<string, EquityCalculationResult>;
  precomputeCommonScenarios: () => void;
}
```

### Performance Optimizations

```typescript
// Calculation caching strategy
class CalculationCache {
  private cache = new Map<string, EquityCalculationResult>();
  
  getCacheKey(input: EquityCalculationInput): string {
    return JSON.stringify({
      exitAmount: input.exitAmountCents.toString(),
      equityHash: this.hashEquityStructure(input.equityStructure),
    });
  }
  
  precompute(scenarios: number[]): void {
    // Pre-calculate common exit amounts
    // Background processing for smooth UX
  }
}

// Debounced calculation updates
const useDebouncedCalculation = (delay = 100) => {
  const [isCalculating, setIsCalculating] = useState(false);
  
  return useCallback(
    debounce((input: EquityCalculationInput) => {
      setIsCalculating(true);
      // Perform calculation
      setIsCalculating(false);
    }, delay),
    []
  );
};
```

### URL State Management

```typescript
// Shareable scenario URLs
interface ScenarioURL {
  scenarioId?: string;
  exitAmount: number;
  termMods: string; // Base64 encoded modifications
  view: 'waterfall' | 'table' | 'comparison';
  readOnly: boolean;
}

const useScenarioURL = () => {
  const encodeState = (state: PlaygroundState): string => {
    return btoa(JSON.stringify({
      exitAmount: state.scenario.exitAmountCents.toString(),
      termMods: state.termModifications,
    }));
  };
  
  const decodeState = (encoded: string): Partial<PlaygroundState> => {
    const data = JSON.parse(atob(encoded));
    return {
      scenario: {
        ...defaultScenario,
        exitAmountCents: BigInt(data.exitAmount),
      },
      termModifications: data.termMods,
    };
  };
};
```

---

## Implementation Timeline

### Week 1: Enhanced Core UX
- **Days 1-2**: Log-scaled slider and scenario header
- **Days 3-4**: Cumulative totals and undistributed tracking
- **Days 5-7**: Click-to-drill functionality and testing

### Week 2: Advanced Analytics
- **Days 1-3**: Breakpoint detection and sensitivity analysis
- **Days 4-5**: Enhanced detail table with IRR calculations
- **Days 6-7**: Export functionality (CSV, basic PDF)

### Week 3: Power User Features
- **Days 1-3**: Term controls panel with dynamic adjustments
- **Days 4-5**: Scenario library and management
- **Days 6-7**: Scenario comparison and diff view

### Week 4: Trust & Compliance
- **Days 1-3**: Audit trail and "show math" functionality
- **Days 4-5**: Board deck export with templates
- **Days 6-7**: Excel model export and final testing

---

## Success Metrics & Validation

### User Experience Metrics
- **Time to Insight**: < 5 seconds to understand current waterfall
- **Scenario Creation Speed**: < 30 seconds to create and compare scenarios
- **Learning Curve**: Non-finance users can operate independently
- **Board Readiness**: One-click export to presentation format

### Technical Performance Metrics
- **Calculation Speed**: < 50ms for scenario updates
- **Visual Responsiveness**: 60fps animations during slider use
- **Cache Hit Rate**: > 80% for common scenario variations
- **Export Generation**: < 10 seconds for board deck PDF

### Competitive Benchmarks
- **vs Carta**: Faster scenario switching, better visual clarity
- **vs Pulley**: More comprehensive audit trail, better exports
- **vs Ledgy**: Superior breakpoint analysis, better UX
- **vs Market**: Best-in-class combination of speed, features, and usability

---

## Risk Mitigation

### Technical Risks
- **Performance**: Implement progressive enhancement and caching
- **Complexity**: Maintain simple core with advanced features as opt-in
- **Browser Compatibility**: Target modern browsers, graceful degradation

### User Experience Risks
- **Feature Overload**: Use progressive disclosure and smart defaults
- **Learning Curve**: Provide guided tours and contextual help
- **Data Accuracy**: Extensive testing against known scenarios

### Business Risks
- **Development Time**: Prioritize core features first, advanced features later
- **Resource Allocation**: Modular implementation allows for team scaling
- **Market Changes**: Flexible architecture adapts to new requirements

This implementation plan provides a clear roadmap to transform our liquidation waterfall into a world-class experience that exceeds current market leaders while maintaining the performance and usability that makes it accessible to all stakeholders.