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
