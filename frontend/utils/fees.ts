export const DIVIDEND_BASE_FEE_CENTS = 30;
export const DIVIDEND_PERCENTAGE = 2.9;
export const DIVIDEND_MAX_FEE_CENTS = 3000;

export const calculateDividendFee = (totalAmountInUsd: string): number => {
  const totalAmountInCents = Math.round(parseFloat(totalAmountInUsd) * 100);
  const percentageFee = Math.round((totalAmountInCents * DIVIDEND_PERCENTAGE) / 100);
  const fee = DIVIDEND_BASE_FEE_CENTS + percentageFee;

  return Math.min(fee, DIVIDEND_MAX_FEE_CENTS);
};
