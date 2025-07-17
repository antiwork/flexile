# Waterfall Playground - Remaining Implementation Plan

## Overview
The waterfall playground is a fully client-side tool for modeling liquidation scenarios. Users can configure ALL waterfall and convertible terms in the UI without database storage. This document outlines the remaining work to complete the playground.

## ✅ Completed Features
1. **Core Infrastructure**
   - Zustand store for client-side state management
   - tRPC endpoint to fetch existing cap table data
   - Data loading hook with proper error handling
   - Basic playground page with authorization

2. **Calculation Engine**
   - Full waterfall calculation logic
   - Liquidation preference handling
   - Participation rights
   - Convertible securities conversion
   - Seniority ranking

3. **Visualization**
   - WaterfallChartPro component (fixed phantom undistributed bar)
   - ExitAmountControl with slider and input
   - Real-time calculation updates

4. **Navigation**
   - Added to equity sidebar menu
   - Proper routing setup

## 🚧 Remaining Features

### 1. ShareClassConfiguration Component (Priority: HIGH)
**Purpose**: Allow users to configure ALL waterfall terms for each share class

**Requirements**:
- Editable table/list of share classes
- For each share class, allow editing:
  - Name
  - Preferred vs Common toggle
  - Original issue price
  - Liquidation preference multiple (e.g., 1x, 2x)
  - Participation rights (none, capped, full)
  - Participation cap multiple
  - Seniority rank (for preference stack)
  - Dividend rate
  - Cumulative/compounding toggles
  - Anti-dilution protection type
- Add new hypothetical share classes
- Delete hypothetical share classes (not DB ones)
- Visual indicators for hypothetical vs DB data

**Implementation Notes**:
```typescript
// Component structure
<ShareClassConfiguration>
  <ShareClassList>
    <ShareClassRow editable={true} />
  </ShareClassList>
  <AddShareClassButton />
</ShareClassConfiguration>
```

### 2. ConvertibleSecuritiesBuilder Component (Priority: HIGH)
**Purpose**: Configure ALL terms for convertible securities (SAFEs, Notes)

**Requirements**:
- List existing convertibles from DB
- For each convertible, allow editing:
  - Type (SAFE, Convertible Note)
  - Principal amount
  - Valuation cap
  - Discount rate
  - Interest rate (for notes)
  - Maturity date (for notes)
  - Seniority rank
- Add hypothetical convertibles
- Delete hypothetical convertibles
- Preview conversion calculations

**Implementation Notes**:
```typescript
// Component structure
<ConvertibleSecuritiesBuilder>
  <ConvertibleList>
    <ConvertibleRow editable={true} />
  </ConvertibleList>
  <AddConvertibleButton />
  <ConversionPreview />
</ConvertibleSecuritiesBuilder>
```

### 3. InvestorManagement Component (Priority: MEDIUM)
**Purpose**: Add/remove hypothetical investors (not editing DB investors)

**Requirements**:
- List existing investors from DB (read-only)
- Add hypothetical investors
- Assign holdings to hypothetical investors
- Delete hypothetical investors
- Bulk actions (e.g., create investor pool)

### 4. ScenarioComparison Feature (Priority: MEDIUM)
**Purpose**: Compare multiple scenarios side-by-side

**Requirements**:
- Save current configuration as named scenario
- Load saved scenarios
- Side-by-side comparison view
- Diff highlighting
- Export comparison report

### 5. Import/Export Enhancement (Priority: LOW)
**Current**: Basic JSON export
**Enhance with**:
- Excel export with detailed breakdown
- PDF report generation
- Import from Excel template
- Share via URL (encode config in URL params)

### 6. UI Polish & Responsive Design (Priority: LOW)
- Mobile-responsive layouts
- Keyboard shortcuts
- Undo/redo functionality
- Better loading states
- Tooltips and help content
- Preset templates (YC SAFE, Series A, etc.)

## Technical Considerations

### State Management
- All changes are client-side only
- Clear visual distinction between DB data and hypothetical data
- Efficient recalculation on every change
- Debouncing for performance

### Data Structure
```typescript
// Hypothetical entities use negative IDs
const newShareClass = {
  id: `-${Date.now()}`, // Negative ID for hypothetical
  isHypothetical: true,
  // ... other fields
};
```

### Performance
- Memoize heavy calculations
- Virtual scrolling for large investor lists
- Web Workers for complex scenarios (if needed)

## Next Steps

1. **Build ShareClassConfiguration** - This unlocks the core value prop
2. **Build ConvertibleSecuritiesBuilder** - Completes the term configuration
3. **Add scenario saving/comparison** - Enables "what-if" analysis
4. **Polish and optimize** - Make it production-ready

## User Journey
1. User navigates to Waterfall Playground
2. Existing cap table loads from database
3. User modifies terms (liquidation prefs, participation, etc.)
4. Chart updates in real-time
5. User adds hypothetical investors/securities
6. User saves and compares scenarios
7. User exports final analysis

## Success Criteria
- ✅ Users can model any liquidation scenario
- ✅ All terms are configurable in the UI
- ✅ No database writes (client-side only)
- ✅ Real-time visualization
- ⬜ Easy to understand and use
- ⬜ Handles complex cap tables efficiently