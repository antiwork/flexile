import { Decimal } from "decimal.js";

export type EquityCalculationData = {
  equityPercentage: number;
  sharePriceUsd: number;
};

/**
 * Calculates equity amounts in cents on the frontend to avoid backend requests on every keystroke.
 * This matches the backend calculation logic in trpc/routes/equityCalculations.ts
 */
export function calculateEquityInCents(serviceAmountCents: number, calculationData: EquityCalculationData): number {
  const { equityPercentage, sharePriceUsd } = calculationData;

  let equityAmountInCents = Decimal.mul(serviceAmountCents, equityPercentage).div(100).round().toNumber();
  let equityAmountInOptions = 0;

  if (equityPercentage !== 0 && sharePriceUsd !== 0) {
    equityAmountInOptions = Decimal.div(equityAmountInCents, Decimal.mul(sharePriceUsd, 100)).round().toNumber();
  }

  if (equityAmountInOptions <= 0) {
    equityAmountInCents = 0;
  }

  return equityAmountInCents;
}
