// Client-side liquidation waterfall calculation engine
// Port of the Rails LiquidationScenarioCalculation service

import type {
  PlaygroundEquityStructure,
  PlaygroundPayout,
  EquityCalculationInput,
  EquityCalculationResult,
} from './types';

interface ShareData {
  investorId: string;
  shareClassId: string;
  totalShares: number;
}

interface PayoutAccumulator {
  preference: number;
  participation: number;
  common: number;
  shares: number;
}

export class EquityWaterfallCalculator {
  private equityStructure: PlaygroundEquityStructure;
  private exitAmountCents: bigint;

  constructor(input: EquityCalculationInput) {
    this.equityStructure = input.equityStructure;
    this.exitAmountCents = input.exitAmountCents;
  }

  calculate(): EquityCalculationResult {
    const startTime = performance.now();
    
    try {
      this.validateInput();
      const payouts = this.calculateEquityPayouts();
      const totalDistributed = payouts.reduce((sum, payout) => sum + payout.payoutAmountCents, 0);
      
      return {
        payouts,
        totalDistributed,
        calculationTime: performance.now() - startTime,
      };
    } catch (error) {
      console.error('Equity calculation failed:', error);
      return {
        payouts: [],
        totalDistributed: 0,
        calculationTime: performance.now() - startTime,
      };
    }
  }

  private validateInput(): void {
    if (this.exitAmountCents <= 0n) {
      throw new Error('Exit amount must be positive');
    }

    const hasEquity = this.equityStructure.shareHoldings.length > 0;
    if (!hasEquity) {
      throw new Error('No equity holdings found');
    }
  }

  private calculateEquityPayouts(): PlaygroundPayout[] {
    let remaining = Number(this.exitAmountCents);
    const payouts = new Map<string, PayoutAccumulator>();
    
    // Initialize payout accumulators
    const shareData = this.getShareData();
    shareData.forEach(data => {
      const key = `${data.investorId}-${data.shareClassId}`;
      payouts.set(key, {
        preference: 0,
        participation: 0,
        common: 0,
        shares: data.totalShares,
      });
    });

    // Step 1: Pay liquidation preferences by seniority
    remaining = this.payLiquidationPreferences(shareData, payouts, remaining);

    // Step 2: Distribute remaining proceeds to participating shares
    this.distributeRemainingProceeds(shareData, payouts, remaining);

    // Convert to payout objects
    return this.convertToPayouts(payouts);
  }

  private getShareData(): ShareData[] {
    const shareData = new Map<string, ShareData>();
    
    this.equityStructure.shareHoldings.forEach(holding => {
      const key = `${holding.investorId}-${holding.shareClassId}`;
      const existing = shareData.get(key);
      
      if (existing) {
        existing.totalShares += holding.numberOfShares;
      } else {
        shareData.set(key, {
          investorId: holding.investorId,
          shareClassId: holding.shareClassId,
          totalShares: holding.numberOfShares,
        });
      }
    });

    return Array.from(shareData.values());
  }

  private payLiquidationPreferences(
    shareData: ShareData[],
    payouts: Map<string, PayoutAccumulator>,
    remaining: number
  ): number {
    const shareClassesById = new Map(
      this.equityStructure.shareClasses.map(sc => [sc.id, sc])
    );

    // Sort share classes by seniority (lower rank = higher priority)
    const shareClassesByRank = this.equityStructure.shareClasses
      .filter(sc => sc.liquidationPreferenceMultiple > 0)
      .sort((a, b) => (a.seniorityRank || 1000000) - (b.seniorityRank || 1000000));

    for (const shareClass of shareClassesByRank) {
      if (remaining <= 0) break;

      const holdings = shareData.filter(d => d.shareClassId === shareClass.id);
      if (holdings.length === 0) continue;

      const prefPerShare = shareClass.originalIssuePriceInDollars * 100 * shareClass.liquidationPreferenceMultiple;
      const totalPref = holdings.reduce((sum, h) => sum + (prefPerShare * h.totalShares), 0);
      const amountToPay = Math.min(totalPref, remaining);
      const ratio = totalPref > 0 ? amountToPay / totalPref : 0;

      holdings.forEach(holding => {
        const key = `${holding.investorId}-${holding.shareClassId}`;
        const payout = payouts.get(key)!;
        const paid = (prefPerShare * holding.totalShares) * ratio;
        payout.preference += paid;
      });

      remaining -= amountToPay;
    }

    return remaining;
  }

  private distributeRemainingProceeds(
    shareData: ShareData[],
    payouts: Map<string, PayoutAccumulator>,
    remaining: number
  ): void {
    if (remaining <= 0) return;

    const shareClassesById = new Map(
      this.equityStructure.shareClasses.map(sc => [sc.id, sc])
    );

    // Find shares eligible for participation (common + participating preferred)
    const eligibleHoldings = shareData.filter(data => {
      const shareClass = shareClassesById.get(data.shareClassId);
      return !shareClass?.preferred || shareClass.participating;
    });

    const totalEligibleShares = eligibleHoldings.reduce((sum, h) => sum + h.totalShares, 0);
    if (totalEligibleShares === 0) return;

    const perShareCommon = remaining / totalEligibleShares;

    eligibleHoldings.forEach(holding => {
      const key = `${holding.investorId}-${holding.shareClassId}`;
      const payout = payouts.get(key)!;
      const shareClass = shareClassesById.get(holding.shareClassId)!;
      let amount = perShareCommon * holding.totalShares;

      // Apply participation cap if applicable
      if (shareClass.preferred && shareClass.participating && shareClass.participationCapMultiple) {
        const cap = (shareClass.originalIssuePriceInDollars * 100 * shareClass.participationCapMultiple * holding.totalShares) - payout.preference;
        if (cap > 0) {
          amount = Math.min(amount, cap);
        }
      }

      if (shareClass.preferred && shareClass.participating) {
        payout.participation += amount;
      } else {
        payout.common += amount;
      }
    });
  }

  private convertToPayouts(payouts: Map<string, PayoutAccumulator>): PlaygroundPayout[] {
    const result: PlaygroundPayout[] = [];
    
    payouts.forEach((payout, key) => {
      const [investorId, shareClassId] = key.split('-');
      const investor = this.equityStructure.investors.find(i => i.id === investorId);
      const shareClass = this.equityStructure.shareClasses.find(sc => sc.id === shareClassId);
      
      if (!investor || !shareClass) return;

      const total = payout.preference + payout.participation + payout.common;
      if (total <= 0) return;

      result.push({
        id: `payout-${key}`,
        investorId,
        shareClassId,
        investorName: investor?.name || 'Unknown Investor',
        shareClassName: shareClass?.name || 'Unknown Share Class',
        securityType: 'equity',
        numberOfShares: payout.shares,
        payoutAmountCents: Math.round(total),
        liquidationPreferenceAmount: Math.round(payout.preference),
        participationAmount: Math.round(payout.participation),
        commonProceedsAmount: Math.round(payout.common),
      });
    });

    // Sort by payout amount descending
    return result.sort((a, b) => b.payoutAmountCents - a.payoutAmountCents);
  }
}

// Convenience function for quick calculations
export function calculateWaterfall(input: EquityCalculationInput): EquityCalculationResult {
  const calculator = new EquityWaterfallCalculator(input);
  return calculator.calculate();
}