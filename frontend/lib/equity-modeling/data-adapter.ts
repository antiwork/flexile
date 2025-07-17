// Utility functions to convert between backend data and playground format

import type { RouterOutput } from '@/trpc';
import type {
  PlaygroundEquityStructure,
  PlaygroundInvestor,
  PlaygroundShareClass,
  PlaygroundShareHolding,
  PlaygroundScenario,
} from './types';

type CapTableData = RouterOutput['capTable']['showForWaterfall'];
type ScenarioData = RouterOutput['liquidationScenarios']['show'];

/**
 * Convert backend cap table data to playground equity structure
 */
export function convertCapTableToPlayground(capTable: CapTableData): PlaygroundEquityStructure {
  // Convert investors - now directly available
  const investors: PlaygroundInvestor[] = capTable.investors.map(investor => ({
    id: investor.id,
    name: investor.user?.name || investor.user?.email || 'Unknown Investor',
    type: 'individual', // Default, could be enhanced with entity detection
    email: investor.user?.email,
    isHypothetical: false,
  }));

  // Convert share classes - now directly available
  const shareClasses: PlaygroundShareClass[] = capTable.shareClasses.map(shareClass => ({
    id: shareClass.id,
    name: shareClass.name,
    originalIssuePriceInDollars: parseFloat(shareClass.originalIssuePriceInDollars || '0'),
    liquidationPreferenceMultiple: parseFloat(shareClass.liquidationPreferenceMultiple || '0'),
    participating: shareClass.participating || false,
    participationCapMultiple: shareClass.participationCapMultiple ? 
      parseFloat(shareClass.participationCapMultiple) : undefined,
    seniorityRank: shareClass.seniorityRank || 999,
    preferred: shareClass.preferred || false,
    isHypothetical: false,
  }));

  // Convert share holdings - now with proper structure
  const shareHoldings: PlaygroundShareHolding[] = capTable.shareHoldings.map(holding => ({
    id: holding.id,
    investorId: holding.companyInvestor.id,
    shareClassId: holding.shareClass.id,
    numberOfShares: holding.numberOfShares,
    sharePriceUsd: parseFloat(holding.sharePriceUsd || '0'),
    totalAmountInCents: holding.totalAmountInCents,
    issuedAt: new Date(holding.issuedAt),
    isHypothetical: false,
  }));

  return {
    investors,
    shareClasses,
    shareHoldings,
  };
}

/**
 * Convert backend scenario data to playground scenario
 */
export function convertScenarioToPlayground(scenario: ScenarioData): PlaygroundScenario {
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description || '',
    exitAmountCents: BigInt(scenario.exitAmountCents),
    exitDate: new Date(scenario.exitDate),
    status: 'saved',
  };
}

/**
 * Convert playground equity structure back to format suitable for backend saving
 */
export function convertPlaygroundToSaveFormat(equityStructure: PlaygroundEquityStructure) {
  // Only include hypothetical (new) data for saving
  const newInvestors = equityStructure.investors.filter(i => i.isHypothetical);
  const newShareClasses = equityStructure.shareClasses.filter(sc => sc.isHypothetical);
  const newShareHoldings = equityStructure.shareHoldings.filter(h => h.isHypothetical);

  return {
    investors: newInvestors.map(investor => ({
      name: investor.name,
      type: investor.type,
      email: investor.email,
    })),
    shareClasses: newShareClasses.map(shareClass => ({
      name: shareClass.name,
      originalIssuePriceInDollars: shareClass.originalIssuePriceInDollars,
      liquidationPreferenceMultiple: shareClass.liquidationPreferenceMultiple,
      participating: shareClass.participating,
      participationCapMultiple: shareClass.participationCapMultiple,
      seniorityRank: shareClass.seniorityRank,
      preferred: shareClass.preferred,
    })),
    shareHoldings: newShareHoldings.map(holding => ({
      investorId: holding.investorId,
      shareClassId: holding.shareClassId,
      numberOfShares: holding.numberOfShares,
      sharePriceUsd: holding.sharePriceUsd,
      totalAmountInCents: holding.totalAmountInCents,
      issuedAt: holding.issuedAt,
    })),
  };
}

/**
 * Generate common share class templates
 */
export function getShareClassTemplates(): Omit<PlaygroundShareClass, 'id' | 'isHypothetical'>[] {
  return [
    {
      name: 'Common Stock',
      originalIssuePriceInDollars: 0.01,
      liquidationPreferenceMultiple: 0,
      participating: false,
      seniorityRank: 999,
      preferred: false,
    },
    {
      name: 'Series Seed Preferred',
      originalIssuePriceInDollars: 1.0,
      liquidationPreferenceMultiple: 1.0,
      participating: true,
      seniorityRank: 3,
      preferred: true,
    },
    {
      name: 'Series A Preferred',
      originalIssuePriceInDollars: 2.0,
      liquidationPreferenceMultiple: 1.0,
      participating: true,
      seniorityRank: 2,
      preferred: true,
    },
    {
      name: 'Series B Preferred',
      originalIssuePriceInDollars: 5.0,
      liquidationPreferenceMultiple: 2.0,
      participating: false,
      seniorityRank: 1,
      preferred: true,
    },
  ];
}

/**
 * Validate equity structure for common issues
 */
export function validateEquityStructure(equityStructure: PlaygroundEquityStructure): string[] {
  const errors: string[] = [];

  // Check for investors without holdings
  const investorsWithHoldings = new Set(equityStructure.shareHoldings.map(h => h.investorId));
  const investorsWithoutHoldings = equityStructure.investors
    .filter(i => !investorsWithHoldings.has(i.id))
    .map(i => i.name);
  
  if (investorsWithoutHoldings.length > 0) {
    errors.push(`Investors without holdings: ${investorsWithoutHoldings.join(', ')}`);
  }

  // Check for share classes without holdings
  const shareClassesWithHoldings = new Set(equityStructure.shareHoldings.map(h => h.shareClassId));
  const shareClassesWithoutHoldings = equityStructure.shareClasses
    .filter(sc => !shareClassesWithHoldings.has(sc.id))
    .map(sc => sc.name);
  
  if (shareClassesWithoutHoldings.length > 0) {
    errors.push(`Share classes without holdings: ${shareClassesWithoutHoldings.join(', ')}`);
  }

  // Check for duplicate seniority ranks among preferred shares
  const preferredRanks = equityStructure.shareClasses
    .filter(sc => sc.preferred && sc.liquidationPreferenceMultiple > 0)
    .map(sc => sc.seniorityRank)
    .filter(rank => rank !== undefined);
  
  const duplicateRanks = preferredRanks.filter((rank, index) => preferredRanks.indexOf(rank) !== index);
  if (duplicateRanks.length > 0) {
    errors.push(`Duplicate seniority ranks: ${duplicateRanks.join(', ')}`);
  }

  // Check for unrealistic share prices
  const unrealisticPrices = equityStructure.shareClasses
    .filter(sc => sc.originalIssuePriceInDollars > 1000 || sc.originalIssuePriceInDollars < 0)
    .map(sc => `${sc.name}: $${sc.originalIssuePriceInDollars}`);
  
  if (unrealisticPrices.length > 0) {
    errors.push(`Unrealistic share prices: ${unrealisticPrices.join(', ')}`);
  }

  return errors;
}