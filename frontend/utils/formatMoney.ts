import { Decimal } from "decimal.js";

type FormatMoneyOptions = {
  precise?: boolean;
  /** Use compact notation: $3K, $1.5M, etc. */
  compact?: boolean;
};

export const formatMoney = (
  price: number | bigint | string | Decimal,
  options?: FormatMoneyOptions,
  currency = "USD",
) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    ...(options?.compact
      ? {
          notation: "compact",
          compactDisplay: "short",
          maximumFractionDigits: 1,
        }
      : {
          trailingZeroDisplay: "stripIfInteger",
          maximumFractionDigits: options?.precise ? 10 : undefined,
        }),
  }).format(price instanceof Decimal ? price.toString() : price);

export const formatMoneyFromCents = (cents: number | bigint | string | Decimal, options?: FormatMoneyOptions) =>
  formatMoney(Number(cents) / 100, options);
