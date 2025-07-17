# Client-Side Waterfall Playground - Complete Implementation Plan

## Overview
Create a fully client-side waterfall modeling platform where users can configure every aspect of cap table and waterfall calculations entirely in the browser. No database storage of scenarios - everything is calculated and configured on the client side.

## Key Philosophy
- **ALL terms must be client-side configurable** - every waterfall parameter editable in UI
- **Convert security checklists to be fully client-side** - all convertible securities configurable in playground  
- **Fetch existing cap table from DB** - investors and basic cap table info come from database
- **Focus on term configuration** - playground tweaks exit amount, share class waterfall terms, convertible terms
- **No investor/cap table management** - playground doesn't modify the base cap table
- **World-class UX** matching existing playground standards

## Architecture Decisions

### Database Strategy
- **Keep**: Essential field migrations for share_classes and convertible_securities
- **Remove**: Liquidation scenarios and payouts tables (no scenario storage)
- **Approach**: Fetch existing cap table data (investors, share classes, holdings), configure terms client-side
- **No cap table modification**: Playground doesn't add/edit/remove investors or basic holdings

### Client-Side Data Flow
```
DB Cap Table → Term Config → Calculation Engine → Visual Results
     ↓              ↓              ↓               ↓
Fetch Basic → Edit Terms → Waterfall Calc → Chart Display
```

## Phase 1: Complete Data Structure (Days 1-2)

### 1.1 Enhanced Type Definitions
**File**: `frontend/lib/equity-modeling/types.ts`

```typescript
// Core configurable entities
interface PlaygroundInvestor {
  id: string;
  name: string;
  type: 'individual' | 'entity';
  email?: string;
  isHypothetical?: boolean;
  // Client-side only fields
  createdAt: Date;
  notes?: string;
}

interface PlaygroundShareClass {
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

interface PlaygroundConvertibleSecurity {
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

interface PlaygroundShareHolding {
  id: string;
  investorId: string;
  shareClassId: string;
  numberOfShares: number;
  sharePriceUsd: number;
  totalAmountInCents: number;
  issuedAt: Date;
  isHypothetical?: boolean;
}

// Comprehensive playground state
interface PlaygroundState {
  // Core entities - all configurable
  investors: PlaygroundInvestor[];
  shareClasses: PlaygroundShareClass[];
  shareHoldings: PlaygroundShareHolding[];
  convertibleSecurities: PlaygroundConvertibleSecurity[];
  
  // Scenario configuration
  exitAmountCents: bigint;
  exitDate: Date;
  scenarioName: string;
  scenarioDescription?: string;
  
  // Calculated results
  payouts: PlaygroundPayout[];
  
  // UI state
  isCalculating: boolean;
  activeTab: 'configuration' | 'visualization';
  selectedInvestor?: string;
  selectedShareClass?: string;
  
  // Comparison and history
  comparisonScenarios: PlaygroundScenario[];
  history: PlaygroundHistoryEntry[];
}
```

### 1.2 Client-Side Data Management
**File**: `frontend/lib/equity-modeling/store.ts`

```typescript
interface PlaygroundActions {
  // Investor management
  addInvestor: (investor: Omit<PlaygroundInvestor, 'id'>) => string;
  updateInvestor: (id: string, updates: Partial<PlaygroundInvestor>) => void;
  removeInvestor: (id: string) => void;
  
  // Share class management
  addShareClass: (shareClass: Omit<PlaygroundShareClass, 'id'>) => string;
  updateShareClass: (id: string, updates: Partial<PlaygroundShareClass>) => void;
  removeShareClass: (id: string) => void;
  
  // Convertible securities management
  addConvertibleSecurity: (security: Omit<PlaygroundConvertibleSecurity, 'id'>) => string;
  updateConvertibleSecurity: (id: string, updates: Partial<PlaygroundConvertibleSecurity>) => void;
  removeConvertibleSecurity: (id: string) => void;
  
  // Holdings management
  addShareHolding: (holding: Omit<PlaygroundShareHolding, 'id'>) => string;
  updateShareHolding: (id: string, updates: Partial<PlaygroundShareHolding>) => void;
  removeShareHolding: (id: string) => void;
  
  // Scenario management
  updateScenario: (updates: Partial<PlaygroundScenario>) => void;
  resetToDefaults: () => void;
  
  // Import/Export
  exportConfiguration: () => PlaygroundConfiguration;
  importConfiguration: (config: PlaygroundConfiguration) => void;
  
  // Calculations
  recalculate: () => void;
  
  // History and comparison
  saveToHistory: (name: string) => void;
  loadFromHistory: (id: string) => void;
  addComparisonScenario: (scenario: PlaygroundScenario) => void;
}
```

## Phase 2: Comprehensive UI Components (Days 3-6)

### 2.1 Investor Management Panel
**File**: `frontend/components/playground/InvestorManagementPanel.tsx`

**Features**:
- Add/Edit/Remove investors dynamically
- Support for individuals and entities
- Email validation and formatting
- Notes and metadata fields
- Bulk import from CSV
- Search and filtering

**Design**: 
- Clean table layout with inline editing
- Modal for detailed editing
- Drag-and-drop reordering
- Quick action buttons

### 2.2 Share Class Configuration
**File**: `frontend/components/playground/ShareClassConfiguration.tsx`

**Features**:
- All waterfall terms editable:
  - Liquidation preference multiple
  - Participating/non-participating toggle
  - Participation cap multiple
  - Seniority rank
  - Original issue price
- Visual color coding
- Real-time validation
- Term explanations and tooltips
- Preset configurations (Common, Series A, Series B, etc.)

**Design**:
- Accordion-style panels for each share class
- Tabbed interface for different term categories
- Visual indicators for term relationships
- Interactive examples

### 2.3 Convertible Securities Builder
**File**: `frontend/components/playground/ConvertibleSecuritiesBuilder.tsx`

**Features**:
- Complete convertible modeling:
  - Valuation cap configuration
  - Discount rate settings
  - Interest rate calculations
  - Maturity date handling
  - Seniority rank assignment
- Conversion scenario preview
- Template-based creation
- Bulk operations

**Design**:
- Table-based interface with expandable rows
- Side panel for detailed configuration
- Visual conversion preview
- Template library

### 2.4 Holdings Editor
**File**: `frontend/components/playground/HoldingsEditor.tsx`

**Features**:
- Dynamic share holding management
- Convertible security assignments
- Investor-to-holding relationships
- Share calculation helpers
- Bulk editing capabilities
- Import/export functionality

**Design**:
- Matrix view (investors vs share classes)
- Inline editing with validation
- Visual relationship mapping
- Quick calculation tools

### 2.5 Term Presets System
**File**: `frontend/components/playground/TermPresets.tsx`

**Features**:
- Common configurations:
  - Series A Preferred
  - Series B Preferred
  - Common Stock
  - Standard Convertible Notes
  - SAFE configurations
- Custom preset creation
- Preset library management
- One-click application

## Phase 3: Advanced Features (Days 7-9)

### 3.1 Scenario Comparison
**File**: `frontend/components/playground/ScenarioComparison.tsx`

**Features**:
- Side-by-side scenario comparison
- Difference highlighting
- Key metric comparisons
- Visual charts for multiple scenarios
- Export comparison reports

### 3.2 Import/Export System
**File**: `frontend/lib/equity-modeling/import-export.ts`

**Features**:
- Configuration export (JSON)
- Result export (PDF/Excel)
- CSV import for bulk data
- Template sharing
- Local storage persistence

### 3.3 Validation & Guidance
**File**: `frontend/components/playground/ValidationSystem.tsx`

**Features**:
- Real-time validation
- Helpful tooltips and explanations
- Warning system for unusual configurations
- Guided setup workflows
- Best practices suggestions

### 3.4 Advanced Calculations
**File**: `frontend/lib/equity-modeling/advanced-calculator.ts`

**Features**:
- Complex conversion scenarios
- Multiple liquidation preference handling
- Participation cap calculations
- Seniority waterfall logic
- Edge case handling

## Phase 4: Polish & Performance (Days 10-11)

### 4.1 Responsive Design
**Features**:
- Mobile-friendly interface
- Tablet optimization
- Touch-friendly controls
- Collapsible panels
- Adaptive layouts

### 4.2 Performance Optimization
**Features**:
- Efficient calculation algorithms
- Virtualization for large datasets
- Debounced updates
- Memoized components
- Background calculations

### 4.3 Error Handling
**Features**:
- Graceful error recovery
- User-friendly error messages
- Validation feedback
- Fallback states
- Debug information

### 4.4 User Experience
**Features**:
- Onboarding tours
- Contextual help
- Keyboard shortcuts
- Undo/redo functionality
- Auto-save capabilities

## Main Page Layout

### Route Structure
- **Primary Route**: `/equity/waterfall/playground`
- **No sub-routes** - single comprehensive page
- **Clean URL** - no scenario IDs needed

### Page Layout Design
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Header: Waterfall Playground                              [Export] [Save] [Help] │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─────────────────────────────┐ ┌─────────────────────────────────────────────┐ │
│ │ Configuration Panel         │ │ Waterfall Visualization                     │ │
│ │                             │ │                                             │ │
│ │ ┌─────────────────────────┐ │ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ Scenario Settings       │ │ │ │ WaterfallChartPro                       │ │ │
│ │ │ - Exit Amount           │ │ │ │                                         │ │ │
│ │ │ - Exit Date             │ │ │ │                                         │ │ │
│ │ │ - Name & Description    │ │ │ │                                         │ │ │
│ │ └─────────────────────────┘ │ │ └─────────────────────────────────────────┘ │ │
│ │                             │ │                                             │ │
│ │ ┌─────────────────────────┐ │ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ Investor Management     │ │ │ │ Breakdown Table                         │ │ │
│ │ │ - Add/Edit/Remove       │ │ │ │                                         │ │ │
│ │ │ - Bulk Operations       │ │ │ │                                         │ │ │
│ │ └─────────────────────────┘ │ │ └─────────────────────────────────────────┘ │ │
│ │                             │ │                                             │ │
│ │ ┌─────────────────────────┐ │ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ Share Class Config      │ │ │ │ Summary Stats                           │ │ │
│ │ │ - All Waterfall Terms   │ │ │ │                                         │ │ │
│ │ │ - Real-time Validation  │ │ │ │                                         │ │ │
│ │ └─────────────────────────┘ │ │ └─────────────────────────────────────────┘ │ │
│ │                             │ │                                             │ │
│ │ ┌─────────────────────────┐ │ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ Convertible Securities  │ │ │ │ Comparison View                         │ │ │
│ │ │ - All Convertible Terms │ │ │ │                                         │ │ │
│ │ │ - Conversion Preview    │ │ │ │                                         │ │ │
│ │ └─────────────────────────┘ │ │ └─────────────────────────────────────────┘ │ │
│ │                             │ │                                             │ │
│ │ ┌─────────────────────────┐ │ │                                             │ │
│ │ │ Holdings Editor         │ │ │                                             │ │
│ │ │ - Share Holdings        │ │ │                                             │ │
│ │ │ - Convertible Holdings  │ │ │                                             │ │
│ │ └─────────────────────────┘ │ │                                             │ │
│ └─────────────────────────────┘ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Day 1: Foundation
1. ✅ Create branch from main
2. ✅ Add necessary database migrations
3. ✅ Copy core calculation engine
4. 🔄 Update type definitions
5. 🔄 Set up enhanced state management

### Day 2: Core Infrastructure
1. Create main playground page structure
2. Set up routing and navigation
3. Implement basic data flow
4. Create reusable UI components

### Day 3: Investor Management
1. Build InvestorManagementPanel
2. Implement CRUD operations
3. Add validation and error handling
4. Create bulk operation features

### Day 4: Share Class Configuration
1. Build ShareClassConfiguration component
2. Implement all waterfall term inputs
3. Add real-time validation
4. Create preset system

### Day 5: Convertible Securities
1. Build ConvertibleSecuritiesBuilder
2. Implement all convertible terms
3. Add conversion preview
4. Create template system

### Day 6: Holdings Management
1. Build HoldingsEditor component
2. Implement dynamic holding management
3. Add relationship mapping
4. Create bulk editing features

### Day 7: Advanced Features
1. Implement scenario comparison
2. Add import/export functionality
3. Create validation system
4. Add guidance features

### Day 8: Calculations & Logic
1. Enhance calculation engine
2. Add complex scenarios support
3. Implement real-time updates
4. Add performance optimizations

### Day 9: Polish & UX
1. Implement responsive design
2. Add error handling
3. Create onboarding experience
4. Add keyboard shortcuts

### Day 10: Testing & Refinement
1. Comprehensive testing
2. Edge case handling
3. Performance optimization
4. Bug fixes

### Day 11: Final Polish
1. Documentation
2. User experience refinements
3. Final testing
4. Deployment preparation

## Success Metrics

### Functionality ✅
- All waterfall terms configurable in UI
- All convertible terms configurable in UI
- Real-time calculation updates
- Export functionality works
- No database storage of scenarios
- Complete hypothetical scenario modeling

### User Experience ✅
- Intuitive interface for complex terms
- Fast, responsive interactions
- Clear visualization of results
- Helpful guidance and validation
- Mobile-friendly design
- Professional appearance

### Code Quality ✅
- Clean, maintainable code structure
- Comprehensive TypeScript types
- Thorough testing coverage
- Consistent design patterns
- Performance optimized
- Well documented

## Technical Considerations

### Performance
- Client-side calculations must be fast
- Large datasets should be handled efficiently
- Real-time updates without lag
- Memory management for complex scenarios

### Validation
- All inputs must be validated in real-time
- Helpful error messages
- Prevent invalid configurations
- Guide users to correct setups

### Accessibility
- Keyboard navigation
- Screen reader support
- High contrast support
- Clear focus indicators

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers
- Responsive design
- Progressive enhancement

This document serves as the comprehensive guide for implementing the fully client-side waterfall playground. All components should be built to support complete configurability of every waterfall-related term, creating a powerful "what-if" modeling platform.