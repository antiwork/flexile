export function getTinName(isBusiness: boolean) {
  return isBusiness ? "EIN" : "SSN or ITIN";
}
