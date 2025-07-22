/**
 * Workaround for react-pdf negative currency formatting issue.
 * React-pdf strips minus signs from Intl.NumberFormat formatted currency values.
 * This function manually handles negative values by formatting the absolute value
 * and prepending the minus sign for negative amounts.
 *
 * @param amount - The numeric amount to format
 * @param currency - The currency code (e.g., "USD", "EUR", "SEK")
 * @param locale - The locale for formatting (e.g., "en-US", "sv-SE")
 * @param maximumFractionDigits - Maximum number of decimal places
 * @returns Properly formatted currency string with minus sign preserved
 */

type FormatAmountParams = {
  currency: string;
  amount: number;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatAmount({
  currency,
  amount,
  locale = "en-US",
  minimumFractionDigits,
  maximumFractionDigits,
}: FormatAmountParams) {
  if (!currency) {
    return;
  }

  return Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

export function formatCurrencyForPDF({
  amount,
  currency,
  locale,
  maximumFractionDigits,
}: {
  amount: number;
  currency: string;
  locale?: string;
  maximumFractionDigits?: number;
}): string {
  if (!currency) return "";

  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);

  // Format the absolute value using the standard formatAmount function
  const formatted = formatAmount({
    currency,
    amount: absoluteAmount,
    locale,
    maximumFractionDigits,
  });

  // Manually prepend minus sign for negative values
  return isNegative ? `-${formatted}` : formatted || "";
}
