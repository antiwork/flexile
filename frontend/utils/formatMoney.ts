import { Decimal } from "decimal.js";

export const formatMoney = (
  price: number | bigint | string | Decimal,
  options?: { precise: boolean },
  currency = "USD",
) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    trailingZeroDisplay: "stripIfInteger",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: options?.precise ? 10 : undefined,
  }).format(price instanceof Decimal ? price.toString() : price);

export const formatMoneyFromCents = (cents: number | bigint | string | Decimal, options?: { precise: boolean }) =>
  formatMoney(Number(cents) / 100, options);

/** Formats money in compact form: $3K, $1.5M, etc. */
export const formatMoneyCompact = (dollars: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    compactDisplay: "short",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 1,
  }).format(dollars);

/** Formats money from cents in compact form: $3K, $1.5M, etc. */
export const formatMoneyFromCentsCompact = (cents: number | bigint | string | Decimal, currency = "USD") =>
  formatMoneyCompact(Number(cents) / 100, currency);
