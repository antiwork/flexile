export const formatOwnershipPercentage = (ownership: number) =>
  ownership.toLocaleString([], { style: "percent", maximumFractionDigits: 3, minimumFractionDigits: 3 });
