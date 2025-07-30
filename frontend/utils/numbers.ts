export const formatOwnershipPercentage = (ownership: number) =>
  ownership.toLocaleString([], { style: "percent", maximumFractionDigits: 2, minimumFractionDigits: 2 });
