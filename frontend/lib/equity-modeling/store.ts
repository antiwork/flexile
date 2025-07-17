// Zustand store for equity modeling playground state

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { calculateWaterfall } from './calculator';
import type {
  PlaygroundState,
  PlaygroundInvestor,
  PlaygroundShareClass,
  PlaygroundShareHolding,
  PlaygroundScenario,
  PlaygroundEquityStructure,
} from './types';

interface EquityPlaygroundStore extends PlaygroundState {
  // Actions for scenario management
  setScenario: (scenario: PlaygroundScenario) => void;
  updateExitAmount: (exitAmountCents: bigint) => void;
  updateExitDate: (exitDate: Date) => void;
  
  // Actions for equity structure modifications
  addInvestor: (investor: Omit<PlaygroundInvestor, 'id'>) => PlaygroundInvestor;
  updateInvestor: (id: string, updates: Partial<PlaygroundInvestor>) => void;
  removeInvestor: (id: string) => void;
  
  addShareClass: (shareClass: Omit<PlaygroundShareClass, 'id'>) => PlaygroundShareClass;
  updateShareClass: (id: string, updates: Partial<PlaygroundShareClass>) => void;
  removeShareClass: (id: string) => void;
  
  addShareHolding: (holding: Omit<PlaygroundShareHolding, 'id'>) => PlaygroundShareHolding;
  updateShareHolding: (id: string, updates: Partial<PlaygroundShareHolding>) => void;
  removeShareHolding: (id: string) => void;
  
  // Actions for calculations and comparisons
  recalculate: () => void;
  addComparisonScenario: (scenario: PlaygroundScenario) => void;
  removeComparisonScenario: (scenarioId: string) => void;
  
  // Actions for persistence and reset
  reset: () => void;
  markSaved: () => void;
  loadFromBackendData: (equityStructure: PlaygroundEquityStructure) => void;
  
  // Utilities
  generateId: () => string;
}

const createDefaultScenario = (): PlaygroundScenario => ({
  name: 'New Scenario',
  description: '',
  exitAmountCents: BigInt(10000000), // $100k default - use BigInt() constructor
  exitDate: new Date(),
  status: 'draft',
});

const createDefaultEquityStructure = (): PlaygroundEquityStructure => ({
  investors: [],
  shareClasses: [],
  shareHoldings: [],
});

export const useEquityPlayground = create<EquityPlaygroundStore>()(
  subscribeWithSelector((set, get) => ({
      // Initial state
      scenario: createDefaultScenario(),
      equityStructure: createDefaultEquityStructure(),
      payouts: [],
      isCalculating: false,
      hasUnsavedChanges: false,
      comparisonScenarios: [],
      originalScenario: createDefaultScenario(),
      originalEquityStructure: createDefaultEquityStructure(),

      // Scenario management
      setScenario: (scenario) => set((state) => ({
        ...state,
        scenario,
        originalScenario: structuredClone(scenario),
        hasUnsavedChanges: false,
      })),

      updateExitAmount: (exitAmountCents) => set((state) => ({
        ...state,
        scenario: {
          ...state.scenario,
          exitAmountCents: BigInt(exitAmountCents.toString()),
        },
        hasUnsavedChanges: true,
      })),

      updateExitDate: (exitDate) => set((state) => ({
        ...state,
        scenario: {
          ...state.scenario,
          exitDate,
        },
        hasUnsavedChanges: true,
      })),

      // Investor management
      addInvestor: (investorData) => {
        const id = get().generateId();
        const investor: PlaygroundInvestor = {
          ...investorData,
          id,
          isHypothetical: true,
        };
        
        set((state) => ({
          ...state,
          equityStructure: {
            ...state.equityStructure,
            investors: [...state.equityStructure.investors, investor],
          },
          hasUnsavedChanges: true,
        }));
        
        return investor;
      },

      updateInvestor: (id, updates) => set((state) => ({
        ...state,
        equityStructure: {
          ...state.equityStructure,
          investors: state.equityStructure.investors.map(investor => 
            investor.id === id ? { ...investor, ...updates } : investor
          ),
        },
        hasUnsavedChanges: true,
      })),

      removeInvestor: (id) => set((state) => ({
        ...state,
        equityStructure: {
          ...state.equityStructure,
          investors: state.equityStructure.investors.filter(i => i.id !== id),
          shareHoldings: state.equityStructure.shareHoldings.filter(h => h.investorId !== id),
        },
        hasUnsavedChanges: true,
      })),

      // Share class management
      addShareClass: (shareClassData) => {
        const id = get().generateId();
        const shareClass: PlaygroundShareClass = {
          ...shareClassData,
          id,
          isHypothetical: true,
        };
        
        set((state) => ({
          ...state,
          equityStructure: {
            ...state.equityStructure,
            shareClasses: [...state.equityStructure.shareClasses, shareClass],
          },
          hasUnsavedChanges: true,
        }));
        
        return shareClass;
      },

      updateShareClass: (id, updates) => set((state) => ({
        ...state,
        equityStructure: {
          ...state.equityStructure,
          shareClasses: state.equityStructure.shareClasses.map(shareClass => 
            shareClass.id === id ? { ...shareClass, ...updates } : shareClass
          ),
        },
        hasUnsavedChanges: true,
      })),

      removeShareClass: (id) => set((state) => ({
        ...state,
        equityStructure: {
          ...state.equityStructure,
          shareClasses: state.equityStructure.shareClasses.filter(sc => sc.id !== id),
          shareHoldings: state.equityStructure.shareHoldings.filter(h => h.shareClassId !== id),
        },
        hasUnsavedChanges: true,
      })),

      // Share holding management
      addShareHolding: (holdingData) => {
        const id = get().generateId();
        const holding: PlaygroundShareHolding = {
          ...holdingData,
          id,
          isHypothetical: true,
        };
        
        set((state) => ({
          ...state,
          equityStructure: {
            ...state.equityStructure,
            shareHoldings: [...state.equityStructure.shareHoldings, holding],
          },
          hasUnsavedChanges: true,
        }));
        
        return holding;
      },

      updateShareHolding: (id, updates) => set((state) => ({
        ...state,
        equityStructure: {
          ...state.equityStructure,
          shareHoldings: state.equityStructure.shareHoldings.map(holding => 
            holding.id === id ? { ...holding, ...updates } : holding
          ),
        },
        hasUnsavedChanges: true,
      })),

      removeShareHolding: (id) => set((state) => ({
        ...state,
        equityStructure: {
          ...state.equityStructure,
          shareHoldings: state.equityStructure.shareHoldings.filter(h => h.id !== id),
        },
        hasUnsavedChanges: true,
      })),

      // Calculations
      recalculate: () => {
        const state = get();
        
        set((current) => ({
          ...current,
          isCalculating: true,
        }));

        try {
          const result = calculateWaterfall({
            exitAmountCents: state.scenario.exitAmountCents,
            exitDate: state.scenario.exitDate,
            equityStructure: state.equityStructure,
          });

          set((current) => ({
            ...current,
            payouts: result.payouts,
            isCalculating: false,
          }));
        } catch (error) {
          console.error('Calculation failed:', error);
          set((current) => ({
            ...current,
            payouts: [],
            isCalculating: false,
          }));
        }
      },

      // Comparison scenarios
      addComparisonScenario: (scenario) => set((state) => ({
        ...state,
        comparisonScenarios: [...state.comparisonScenarios, scenario],
      })),

      removeComparisonScenario: (scenarioId) => set((state) => ({
        ...state,
        comparisonScenarios: state.comparisonScenarios.filter(s => s.id !== scenarioId),
      })),

      // Persistence and reset
      reset: () => set((state) => ({
        ...state,
        scenario: structuredClone(state.originalScenario),
        equityStructure: structuredClone(state.originalEquityStructure),
        hasUnsavedChanges: false,
        comparisonScenarios: [],
      })),

      markSaved: () => set((state) => ({
        ...state,
        scenario: {
          ...state.scenario,
          status: 'saved' as const,
        },
        hasUnsavedChanges: false,
      })),

      loadFromBackendData: (equityStructure) => set((state) => ({
        ...state,
        equityStructure: structuredClone(equityStructure),
        originalEquityStructure: structuredClone(equityStructure),
        hasUnsavedChanges: false,
      })),

      // Utilities
      generateId: () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }))
);

// Auto-recalculate when relevant state changes
useEquityPlayground.subscribe(
  (state) => ({
    exitAmount: state.scenario.exitAmountCents,
    equityStructure: state.equityStructure,
  }),
  () => {
    // Debounce recalculation to avoid excessive calculations
    const store = useEquityPlayground.getState();
    if (!store.isCalculating) {
      setTimeout(() => store.recalculate(), 100);
    }
  },
  {
    equalityFn: (a, b) => {
      // Safe comparison that handles BigInt
      const exitAmountEqual = a.exitAmount.toString() === b.exitAmount.toString();
      // Simple reference equality for equity structure (since we use immer)
      const structureEqual = a.equityStructure === b.equityStructure;
      return exitAmountEqual && structureEqual;
    }
  }
);