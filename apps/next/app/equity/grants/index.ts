import { useCurrentCompany, useCurrentUser } from "@/global";

export const relationshipDisplayNames = {
  employee: "Employee",
  consultant: "Consultant",
  investor: "Investor",
  founder: "Founder",
  officer: "Officer",
  executive: "Executive",
  board_member: "Board member",
};

export const optionGrantTypeDisplayNames = { iso: "ISO", nso: "NSO" };

export const vestingTriggerDisplayNames = {
  scheduled: "As per vesting schedule",
  invoice_paid: "As invoices are paid",
};

export const useInvestorQueryParams = () => {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const investorId =
    user.activeRole === "contractorOrInvestor" && "investor" in user.roles ? user.roles.investor?.id : "";
  return {
    companyId: company.id,
    investorId,
    perPage: 50,
    orderBy: "periodEndedAt" as const,
    eventuallyExercisable: true,
    accepted: true,
  };
};
