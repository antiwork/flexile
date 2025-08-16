import { Decimal } from "decimal.js";

export const formatMoney = (
  price: number | bigint | string | Decimal,
  options?: { precise: boolean },
  currency = "USD",
) => {
  // Convert price to a numeric value safely
  const numericValue = price instanceof Decimal ? parseFloat(price.toString()) : Number(price);
  
  // Detect if it's an integer
  const isInteger = Number.isInteger(numericValue);
  
  // Apply appropriate fraction digit settings
  let maximumFractionDigits: number | undefined;
  let minimumFractionDigits: number | undefined;
  
  if (options?.precise) {
    maximumFractionDigits = 10;
  } else if (isInteger) {
    // For integers, set both min and max to 0 to strip trailing zeros
    maximumFractionDigits = 0;
    minimumFractionDigits = 0;
  }
  
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(numericValue);
};

export const formatMoneyFromCents = (cents: number | bigint | string | Decimal, options?: { precise: boolean }) =>
  formatMoney(Number(cents) / 100, options);
