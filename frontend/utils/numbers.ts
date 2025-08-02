import { Decimal } from "decimal.js";

export const formatOwnershipPercentage = (ownership: number) =>
  ownership.toLocaleString([], { style: "percent", maximumFractionDigits: 2, minimumFractionDigits: 2 });

export const formatNumber = (number: number | bigint | string | Decimal, options?: { precise: boolean }) =>
  new Intl.NumberFormat(undefined, {
    style: "decimal",
    trailingZeroDisplay: "stripIfInteger",
    maximumFractionDigits: options?.precise ? 10 : undefined,
  }).format(number instanceof Decimal ? number.toString() : number);
