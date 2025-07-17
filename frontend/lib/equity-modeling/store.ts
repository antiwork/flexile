// Zustand store for client-side waterfall playground
// ALL terms are configurable, no database storage of scenarios

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { calculateWaterfall } from './calculator';
import type {
  PlaygroundState,
  PlaygroundInvestor,
  PlaygroundShareClass,
  PlaygroundShareHolding,
  PlaygroundConvertibleSecurity,
  PlaygroundScenario,
  PlaygroundConfiguration,
  PlaygroundHistoryEntry,
} from './types';

interface PlaygroundActions {
  // Investor management
  addInvestor: (investor: Omit<PlaygroundInvestor, 'id'>) => string;
  updateInvestor: (id: string, updates: Partial<PlaygroundInvestor>) => void;
  removeInvestor: (id: string) => void;
  
  // Share class management
  addShareClass: (shareClass: Omit<PlaygroundShareClass, 'id'>) => string;
  updateShareClass: (id: string, updates: Partial<PlaygroundShareClass>) => void;
  removeShareClass: (id: string) => void;
  
  // Share holding management
  addShareHolding: (holding: Omit<PlaygroundShareHolding, 'id'>) => string;
  updateShareHolding: (id: string, updates: Partial<PlaygroundShareHolding>) => void;
  removeShareHolding: (id: string) => void;
  
  // Convertible securities management
  addConvertibleSecurity: (security: Omit<PlaygroundConvertibleSecurity, 'id'>) => string;
  updateConvertibleSecurity: (id: string, updates: Partial<PlaygroundConvertibleSecurity>) => void;
  removeConvertibleSecurity: (id: string) => void;
  
  // Scenario management
  updateScenario: (updates: Partial<PlaygroundScenario>) => void;
  updateExitAmount: (exitAmountCents: bigint) => void;
  updateExitDate: (exitDate: Date) => void;
  
  // Calculations
  recalculate: () => void;
  
  // Configuration management
  exportConfiguration: () => PlaygroundConfiguration;
  importConfiguration: (config: PlaygroundConfiguration) => void;
  resetToDefaults: () => void;
  
  // History and comparison
  saveToHistory: (name: string) => void;
  loadFromHistory: (id: string) => void;
  clearHistory: () => void;
  addComparisonScenario: (scenario: PlaygroundScenario) => void;
  removeComparisonScenario: (id: string) => void;
  
  // UI state
  setActiveTab: (tab: 'configuration' | 'visualization') => void;
  setSelectedInvestor: (id?: string) => void;
  setSelectedShareClass: (id?: string) => void;
  
  // Utilities
  generateId: () => string;
  markSaved: () => void;
}

interface PlaygroundStore extends PlaygroundState, PlaygroundActions {}

const createDefaultScenario = (): PlaygroundScenario => ({
  name: 'New Scenario',
  description: '',
  exitAmountCents: BigInt(10000000), // $100k default
  exitDate: new Date(),
  createdAt: new Date(),
});

const createDefaultInvestor = (): PlaygroundInvestor => ({
  id: '',
  name: 'New Investor',
  type: 'individual',
  isHypothetical: true,
  createdAt: new Date(),
});

const createDefaultShareClass = (): PlaygroundShareClass => ({
  id: '',
  name: 'Common Stock',
  preferred: false,
  originalIssuePriceInDollars: 1.0,
  liquidationPreferenceMultiple: 1.0,
  participating: false,
  seniorityRank: 0,
  isHypothetical: true,
  color: '#94A3B8',
});

const createDefaultConvertibleSecurity = (): PlaygroundConvertibleSecurity => ({
  id: '',
  investorId: '',
  principalValueInCents: 100000, // $1000
  issuedAt: new Date(),
  impliedShares: 1000,
  isHypothetical: true,
});

export const usePlayground = create<PlaygroundStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    investors: [],
    shareClasses: [],
    shareHoldings: [],
    convertibleSecurities: [],
    scenario: createDefaultScenario(),
    payouts: [],
    isCalculating: false,
    activeTab: 'configuration',
    selectedInvestor: undefined,
    selectedShareClass: undefined,
    comparisonScenarios: [],
    history: [],
    hasUnsavedChanges: false,

    // Investor management
    addInvestor: (investorData) => {
      const id = get().generateId();
      const investor: PlaygroundInvestor = {
        ...createDefaultInvestor(),
        ...investorData,
        id,
        createdAt: new Date(),
      };
      
      set((state) => ({
        investors: [...state.investors, investor],
        hasUnsavedChanges: true,
      }));
      
      return id;
    },

    updateInvestor: (id, updates) => set((state) => ({
      investors: state.investors.map(investor => 
        investor.id === id ? { ...investor, ...updates } : investor
      ),
      hasUnsavedChanges: true,
    })),

    removeInvestor: (id) => set((state) => ({
      investors: state.investors.filter(i => i.id !== id),
      shareHoldings: state.shareHoldings.filter(h => h.investorId !== id),
      convertibleSecurities: state.convertibleSecurities.filter(c => c.investorId !== id),
      hasUnsavedChanges: true,
    })),

    // Share class management
    addShareClass: (shareClassData) => {
      const id = get().generateId();
      const shareClass: PlaygroundShareClass = {
        ...createDefaultShareClass(),
        ...shareClassData,
        id,
      };
      
      set((state) => ({
        shareClasses: [...state.shareClasses, shareClass],
        hasUnsavedChanges: true,
      }));
      
      return id;
    },

    updateShareClass: (id, updates) => set((state) => ({
      shareClasses: state.shareClasses.map(shareClass => 
        shareClass.id === id ? { ...shareClass, ...updates } : shareClass
      ),
      hasUnsavedChanges: true,
    })),

    removeShareClass: (id) => set((state) => ({
      shareClasses: state.shareClasses.filter(sc => sc.id !== id),
      shareHoldings: state.shareHoldings.filter(h => h.shareClassId !== id),
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
        shareHoldings: [...state.shareHoldings, holding],
        hasUnsavedChanges: true,
      }));
      
      return id;
    },

    updateShareHolding: (id, updates) => set((state) => ({
      shareHoldings: state.shareHoldings.map(holding => 
        holding.id === id ? { ...holding, ...updates } : holding
      ),
      hasUnsavedChanges: true,
    })),

    removeShareHolding: (id) => set((state) => ({
      shareHoldings: state.shareHoldings.filter(h => h.id !== id),
      hasUnsavedChanges: true,
    })),

    // Convertible securities management
    addConvertibleSecurity: (securityData) => {
      const id = get().generateId();
      const security: PlaygroundConvertibleSecurity = {
        ...createDefaultConvertibleSecurity(),
        ...securityData,
        id,
      };
      
      set((state) => ({
        convertibleSecurities: [...state.convertibleSecurities, security],
        hasUnsavedChanges: true,
      }));
      
      return id;
    },

    updateConvertibleSecurity: (id, updates) => set((state) => ({
      convertibleSecurities: state.convertibleSecurities.map(security => 
        security.id === id ? { ...security, ...updates } : security
      ),
      hasUnsavedChanges: true,
    })),

    removeConvertibleSecurity: (id) => set((state) => ({
      convertibleSecurities: state.convertibleSecurities.filter(c => c.id !== id),
      hasUnsavedChanges: true,
    })),

    // Scenario management
    updateScenario: (updates) => set((state) => ({
      scenario: { ...state.scenario, ...updates },
      hasUnsavedChanges: true,
    })),

    updateExitAmount: (exitAmountCents) => set((state) => ({
      scenario: {
        ...state.scenario,
        exitAmountCents: BigInt(exitAmountCents.toString()),
      },
      hasUnsavedChanges: true,
    })),

    updateExitDate: (exitDate) => set((state) => ({
      scenario: {
        ...state.scenario,
        exitDate,
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
          equityStructure: {
            investors: state.investors,
            shareClasses: state.shareClasses,
            shareHoldings: state.shareHoldings,
            convertibleSecurities: state.convertibleSecurities,
          },
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

    // Configuration management
    exportConfiguration: () => {
      const state = get();
      return {
        version: '1.0.0',
        createdAt: new Date(),
        scenario: state.scenario,
        equityStructure: {
          investors: state.investors,
          shareClasses: state.shareClasses,
          shareHoldings: state.shareHoldings,
          convertibleSecurities: state.convertibleSecurities,
        },
      };
    },

    importConfiguration: (config) => {
      set((state) => ({
        ...state,
        scenario: config.scenario,
        investors: config.equityStructure.investors,
        shareClasses: config.equityStructure.shareClasses,
        shareHoldings: config.equityStructure.shareHoldings,
        convertibleSecurities: config.equityStructure.convertibleSecurities,
        hasUnsavedChanges: true,
      }));
    },

    resetToDefaults: () => set(() => ({
      investors: [],
      shareClasses: [],
      shareHoldings: [],
      convertibleSecurities: [],
      scenario: createDefaultScenario(),
      payouts: [],
      isCalculating: false,
      activeTab: 'configuration',
      selectedInvestor: undefined,
      selectedShareClass: undefined,
      comparisonScenarios: [],
      hasUnsavedChanges: false,
    })),

    // History and comparison
    saveToHistory: (name) => {
      const state = get();
      const historyEntry: PlaygroundHistoryEntry = {
        id: state.generateId(),
        name,
        timestamp: new Date(),
        scenario: state.scenario,
        equityStructure: {
          investors: state.investors,
          shareClasses: state.shareClasses,
          shareHoldings: state.shareHoldings,
          convertibleSecurities: state.convertibleSecurities,
        },
        payouts: state.payouts,
      };
      
      set((current) => ({
        history: [historyEntry, ...current.history.slice(0, 9)], // Keep last 10
      }));
    },

    loadFromHistory: (id) => {
      const state = get();
      const historyEntry = state.history.find(h => h.id === id);
      if (historyEntry) {
        set({
          scenario: historyEntry.scenario,
          investors: historyEntry.equityStructure.investors,
          shareClasses: historyEntry.equityStructure.shareClasses,
          shareHoldings: historyEntry.equityStructure.shareHoldings,
          convertibleSecurities: historyEntry.equityStructure.convertibleSecurities,
          payouts: historyEntry.payouts,
          hasUnsavedChanges: false,
        });
      }
    },

    clearHistory: () => set({ history: [] }),

    addComparisonScenario: (scenario) => set((state) => ({
      comparisonScenarios: [...state.comparisonScenarios, scenario],
    })),

    removeComparisonScenario: (id) => set((state) => ({
      comparisonScenarios: state.comparisonScenarios.filter(s => s.id !== id),
    })),

    // UI state
    setActiveTab: (activeTab) => set({ activeTab }),
    setSelectedInvestor: (selectedInvestor) => set({ selectedInvestor }),
    setSelectedShareClass: (selectedShareClass) => set({ selectedShareClass }),

    // Utilities
    generateId: () => `playground_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    markSaved: () => set({ hasUnsavedChanges: false }),
  }))
);

// Auto-recalculate when relevant state changes
usePlayground.subscribe(
  (state) => ({
    exitAmount: state.scenario.exitAmountCents,
    investors: state.investors,
    shareClasses: state.shareClasses,
    shareHoldings: state.shareHoldings,
    convertibleSecurities: state.convertibleSecurities,
  }),
  () => {
    // Debounce recalculation to avoid excessive calculations
    const store = usePlayground.getState();
    if (!store.isCalculating) {
      setTimeout(() => store.recalculate(), 100);
    }
  },
  {
    equalityFn: (a, b) => {
      // Safe comparison that handles BigInt
      const exitAmountEqual = a.exitAmount.toString() === b.exitAmount.toString();
      // Simple reference equality for other arrays
      return (
        exitAmountEqual &&
        a.investors === b.investors &&
        a.shareClasses === b.shareClasses &&
        a.shareHoldings === b.shareHoldings &&
        a.convertibleSecurities === b.convertibleSecurities
      );
    }
  }
);