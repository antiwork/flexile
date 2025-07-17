// Hook to load cap table data from the database into the playground store

import { useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { useCurrentCompany } from '@/global';
import { usePlayground } from './store';

export function useLoadCapTable() {
  const company = useCurrentCompany();
  const { 
    importConfiguration,
    isInitialized,
    setInitialized 
  } = usePlayground();

  const { data, isLoading, error } = trpc.waterfallPlayground.getCapTableData.useQuery({ companyId: company.id });

  useEffect(() => {
    if (data && !isInitialized) {
      console.log('Loading cap table data:', data);
      try {
        // Transform the data to match our playground types
        const transformedData = {
          investors: (data.investors || []).map(inv => ({
            id: inv.id || '',
            name: inv.name || 'Unknown Investor',
            type: 'entity' as const, // Default to entity for company investors
            email: inv.email || undefined,
            isHypothetical: false,
            createdAt: new Date(),
          })),
          
          shareClasses: (data.shareClasses || []).map(sc => ({
            id: sc.id ? sc.id.toString() : '',
            name: sc.name || 'Unknown Share Class',
            preferred: sc.preferred || false,
            originalIssuePriceInDollars: Number(sc.originalIssuePriceInDollars) || 1.0,
            // All waterfall terms from database
            liquidationPreferenceMultiple: Number(sc.liquidationPreferenceMultiple) || 1.0,
            participating: sc.participating || false,
            participationCapMultiple: sc.participationCapMultiple ? Number(sc.participationCapMultiple) : undefined,
            seniorityRank: sc.seniorityRank || 0,
            dividendRate: sc.dividendRate ? Number(sc.dividendRate) : undefined,
            compoundingDividends: sc.compoundingDividends || false,
            cumulativeDividends: sc.cumulativeDividends || false,
            antidilutionProtection: sc.antidilutionProtection || 'none',
            isHypothetical: false,
            color: sc.preferred ? '#60A5FA' : '#94A3B8',
          })),
          
          shareHoldings: (data.shareHoldings || []).map(sh => ({
            id: sh.id ? sh.id.toString() : '',
            investorId: sh.investorId || '',
            shareClassId: sh.shareClassId ? sh.shareClassId.toString() : '',
            numberOfShares: Number(sh.numberOfShares) || 0,
            sharePriceUsd: Number(sh.sharePriceUsd) || 1.0,
            totalAmountInCents: Number(sh.totalAmountInCents) || 0,
            issuedAt: sh.issuedAt ? new Date(sh.issuedAt) : new Date(),
            isHypothetical: false,
          })),
          
          convertibleSecurities: (data.convertibleSecurities || []).map(cs => ({
            id: cs.id ? cs.id.toString() : '',
            investorId: cs.investorId || '',
            convertibleType: (cs.convertibleType || 'SAFE') as 'SAFE' | 'Convertible Note',
            principalValueInCents: Number(cs.principalValueInCents) || 0,
            valuationCapCents: cs.valuationCapInDollars ? BigInt(Math.round(Number(cs.valuationCapInDollars) * 100)) : undefined,
            discountRatePercent: cs.discountRate ? Number(cs.discountRate) : undefined,
            interestRatePercent: cs.interestRate ? Number(cs.interestRate) : undefined,
            maturityDate: cs.maturityDate ? new Date(cs.maturityDate) : undefined,
            issuedAt: cs.issuedAt ? new Date(cs.issuedAt) : new Date(),
            seniorityRank: 0,
            isHypothetical: false,
          })),
        };

        const config = {
          scenario: {
            name: 'Current Cap Table',
            description: 'Loaded from database',
            exitAmountCents: BigInt(10000000000), // $100M default
            exitDate: new Date(),
            createdAt: new Date(),
          },
          equityStructure: transformedData,
        };

        importConfiguration(config);
        setInitialized(true);
      } catch (err) {
        console.error('Error loading cap table data:', err);
      }
    }
  }, [data, isInitialized, importConfiguration, setInitialized]);

  return { isLoading, error };
}