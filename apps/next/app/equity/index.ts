import type { TabLink } from "@/components/Tabs";
import { type Company, type CurrentUser } from "@/models/user";

export const navLinks = (user: CurrentUser, company: Company): TabLink[] => {
  const isAdmin = user.activeRole === "administrator";
  const isLawyer = user.activeRole === "lawyer";
  const isInvestor = user.activeRole === "contractorOrInvestor" && "investor" in user.roles;
  const links: (TabLink | null)[] = [
    company.flags.includes("financing_rounds") && (isAdmin || isLawyer || isInvestor)
      ? { label: "Rounds", route: "/equity/financing_rounds" }
      : null,
    company.flags.includes("cap_table") && (isAdmin || isLawyer || isInvestor)
      ? { label: "Cap table", route: "/equity/cap_table" }
      : null,
    company.flags.includes("equity_grants") && (isAdmin || isLawyer)
      ? { label: "Option pools", route: "/equity/option_pools" }
      : null,
    company.flags.includes("equity_grants") && (isAdmin || isLawyer || (isInvestor && user.roles.investor?.hasGrants))
      ? { label: "Options", route: "/equity/grants" }
      : null,
    isInvestor && user.roles.investor?.hasShares ? { label: "Shares", route: "/equity/shares" } : null,
    isInvestor && user.roles.investor?.hasConvertibles
      ? { label: "Convertibles", route: "/equity/convertibles" }
      : null,
    isInvestor
      ? { label: "Dividends", route: "/equity/dividends" }
      : company.flags.includes("dividends") && (isAdmin || isLawyer)
        ? { label: "Dividends", route: "/equity/dividend_rounds" }
        : null,
    company.flags.includes("tender_offers") && (isAdmin || isInvestor)
      ? { label: "Buybacks", route: "/equity/tender_offers" }
      : null,
  ];
  return links.filter((link) => !!link);
};
