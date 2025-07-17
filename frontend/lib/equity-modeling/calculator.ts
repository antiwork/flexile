// Client-side liquidation waterfall calculation engine
// Focused on term configuration - fetches base cap table from DB

import type {
  PlaygroundEquityStructure,
  PlaygroundPayout,
  EquityCalculationInput,
  EquityCalculationResult,
  PlaygroundShareClass,
  PlaygroundConvertibleSecurity,
} from './types';

interface ShareData {
  investorId: string;
  shareClassId: string;
  totalShares: number;
  shareClass: PlaygroundShareClass;
}

interface ConvertibleData {
  investorId: string;
  security: PlaygroundConvertibleSecurity;
  conversionShares: number;
  shareClassId: string; // Which share class this converts to
}

interface PayoutAccumulator {
  preference: number;
  participation: number;
  common: number;
  shares: number;
  investorName: string;
  shareClassName: string;
}

export class EquityWaterfallCalculator {
  private equityStructure: PlaygroundEquityStructure;
  private exitAmountCents: bigint;
  private exitDate: Date;

  constructor(input: EquityCalculationInput) {
    this.equityStructure = input.equityStructure;
    this.exitAmountCents = input.exitAmountCents;
    this.exitDate = input.exitDate;
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
    
    // Get share data (regular share holdings)
    const shareData = this.getShareData();
    
    // Get convertible data (convertible securities that should convert)
    const convertibleData = this.getConvertibleData();
    
    // Combine all data for unified processing
    const allData = [...shareData, ...this.convertConvertibleData(convertibleData)];
    
    // Initialize payout accumulators
    allData.forEach(data => {
      const key = `${data.investorId}-${data.shareClassId}`;
      const investor = this.equityStructure.investors.find(i => i.id === data.investorId);
      const existing = payouts.get(key);
      
      if (existing) {
        existing.shares += data.totalShares;
      } else {
        payouts.set(key, {
          preference: 0,
          participation: 0,
          common: 0,
          shares: data.totalShares,
          investorName: investor?.name || 'Unknown Investor',
          shareClassName: data.shareClass.name,
        });
      }
    });

    // Step 1: Pay liquidation preferences by seniority
    remaining = this.payLiquidationPreferences(allData, payouts, remaining);

    // Step 2: Distribute remaining proceeds to participating shares
    this.distributeRemainingProceeds(allData, payouts, remaining);

    // Convert to payout objects
    return this.convertToPayouts(payouts);
  }

  private getShareData(): ShareData[] {
    const shareData = new Map<string, ShareData>();
    
    this.equityStructure.shareHoldings.forEach(holding => {
      const shareClass = this.equityStructure.shareClasses.find(sc => sc.id === holding.shareClassId);
      if (!shareClass) return;
      
      const key = `${holding.investorId}-${holding.shareClassId}`;
      const existing = shareData.get(key);
      
      if (existing) {
        existing.totalShares += holding.numberOfShares;
      } else {
        shareData.set(key, {
          investorId: holding.investorId,
          shareClassId: holding.shareClassId,
          totalShares: holding.numberOfShares,
          shareClass,
        });
      }
    });

    return Array.from(shareData.values());
  }

  private getConvertibleData(): ConvertibleData[] {
    return this.equityStructure.convertibleSecurities.map(security => {
      // Simple conversion logic - in real implementation, this would consider:
      // - Valuation cap vs current valuation
      // - Discount rate
      // - Maturity date
      // - Whether conversion is beneficial
      
      // For now, assume conversion to common stock
      const commonShareClass = this.equityStructure.shareClasses.find(sc => !sc.preferred);
      const shareClassId = commonShareClass?.id || '';
      
      return {
        investorId: security.investorId,
        security,
        conversionShares: security.impliedShares,
        shareClassId,
      };
    });
  }

  private convertConvertibleData(convertibleData: ConvertibleData[]): ShareData[] {
    return convertibleData.map(data => {
      const shareClass = this.equityStructure.shareClasses.find(sc => sc.id === data.shareClassId);
      return {
        investorId: data.investorId,
        shareClassId: data.shareClassId,
        totalShares: data.conversionShares,
        shareClass: shareClass || this.equityStructure.shareClasses[0],
      };
    }).filter(data => data.shareClass);
  }

  private payLiquidationPreferences(
    allData: ShareData[],
    payouts: Map<string, PayoutAccumulator>,
    remaining: number
  ): number {
    // Group by share class and sort by seniority
    const shareClassGroups = new Map<string, ShareData[]>();
    allData.forEach(data => {
      if (!shareClassGroups.has(data.shareClassId)) {
        shareClassGroups.set(data.shareClassId, []);
      }
      shareClassGroups.get(data.shareClassId)!.push(data);
    });

    // Sort share classes by seniority (lower rank = higher priority)
    const sortedShareClasses = Array.from(shareClassGroups.entries())
      .map(([shareClassId, data]) => ({
        shareClassId,
        data,
        shareClass: data[0].shareClass,
      }))
      .filter(item => item.shareClass.liquidationPreferenceMultiple > 0)
      .sort((a, b) => (a.shareClass.seniorityRank || 1000000) - (b.shareClass.seniorityRank || 1000000));

    for (const { shareClassId, data, shareClass } of sortedShareClasses) {
      if (remaining <= 0) break;

      const prefPerShare = shareClass.originalIssuePriceInDollars * 100 * shareClass.liquidationPreferenceMultiple;
      const totalPref = data.reduce((sum, d) => sum + (prefPerShare * d.totalShares), 0);
      const amountToPay = Math.min(totalPref, remaining);
      const ratio = totalPref > 0 ? amountToPay / totalPref : 0;

      data.forEach(holding => {
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
    allData: ShareData[],
    payouts: Map<string, PayoutAccumulator>,
    remaining: number
  ): void {
    if (remaining <= 0) return;

    // Iteratively distribute remaining proceeds, handling caps properly
    while (remaining > 0.01) { // Small threshold to handle rounding
      // Find shares eligible for participation that haven't hit their cap
      const eligibleData = allData.filter(data => {
        const shareClass = data.shareClass;
        
        // Include if: (1) common stock OR (2) participating preferred that hasn't hit cap
        if (!shareClass.preferred || shareClass.participating) {
          if (shareClass.preferred && shareClass.participating && shareClass.participationCapMultiple) {
            // Check if this holding has hit its cap
            const key = `${data.investorId}-${data.shareClassId}`;
            const payout = payouts.get(key)!;
            const currentTotal = payout.preference + payout.participation;
            const maxTotal = shareClass.originalIssuePriceInDollars * 100 * shareClass.participationCapMultiple * data.totalShares;
            return currentTotal < maxTotal; // Still has room
          }
          return true; // No cap, always eligible
        }
        return false; // Non-participating preferred
      });

      if (eligibleData.length === 0) break;

      const totalEligibleShares = eligibleData.reduce((sum, d) => sum + d.totalShares, 0);
      if (totalEligibleShares === 0) break;

      const perShareAmount = remaining / totalEligibleShares;
      let distributedThisRound = 0;

      eligibleData.forEach(holding => {
        const key = `${holding.investorId}-${holding.shareClassId}`;
        const payout = payouts.get(key)!;
        const shareClass = holding.shareClass;
        const amount = perShareAmount * holding.totalShares;

        if (shareClass.preferred && shareClass.participating && shareClass.participationCapMultiple) {
          // Apply participation cap
          const currentParticipation = payout.participation;
          const currentPreference = payout.preference;
          const maxTotal = shareClass.originalIssuePriceInDollars * 100 * shareClass.participationCapMultiple * holding.totalShares;
          const maxParticipation = maxTotal - currentPreference;
          const availableCap = maxParticipation - currentParticipation;
          
          if (availableCap > 0) {
            const actualAmount = Math.min(amount, availableCap);
            payout.participation += actualAmount;
            distributedThisRound += actualAmount;
          }
        } else if (shareClass.preferred && shareClass.participating) {
          // Participating with no cap
          payout.participation += amount;
          distributedThisRound += amount;
        } else {
          // Common stock
          payout.common += amount;
          distributedThisRound += amount;
        }
      });

      remaining -= distributedThisRound;
      
      // Safety check to prevent infinite loops
      if (distributedThisRound < 0.01) break;
    }
  }

  private convertToPayouts(payouts: Map<string, PayoutAccumulator>): PlaygroundPayout[] {
    const result: PlaygroundPayout[] = [];
    
    payouts.forEach((payout, key) => {
      const [investorId, shareClassId] = key.split('-');
      const shareClass = this.equityStructure.shareClasses.find(sc => sc.id === shareClassId);
      
      if (!shareClass) return;

      const total = payout.preference + payout.participation + payout.common;
      if (total <= 0) return;

      result.push({
        id: `payout-${key}`,
        investorId,
        shareClassId,
        investorName: payout.investorName,
        shareClassName: payout.shareClassName,
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