import type { TabLink } from "@/components/Tabs";
import { type Company, type CurrentUser } from "@/models/user";

export const navLinks = (user: CurrentUser, company: Company): TabLink[] => {
  const isAdmin = !!user.roles.administrator;
  const isLawyer = !!user.roles.lawyer;
  const isInvestor = !!user.roles.investor;
  const links: (TabLink | null)[] = [
    company.equityEnabled && (isAdmin || isLawyer || isInvestor)
      ? { label: "Investors", route: "/equity/investors" }
      : null,
    company.equityEnabled && (isAdmin || isLawyer) ? { label: "Option pools", route: "/equity/option_pools" } : null,
    company.equityEnabled && (isAdmin || isLawyer) ? { label: "Equity grants", route: "/equity/grants" } : null,
    company.equityEnabled && isInvestor && user.roles.investor?.hasGrants
      ? { label: "Options", route: "/equity/options" }
      : null,
    isInvestor && user.roles.investor?.hasShares ? { label: "Shares", route: "/equity/shares" } : null,
    isInvestor && user.roles.investor?.hasConvertibles
      ? { label: "Convertibles", route: "/equity/convertibles" }
      : null,
    company.equityEnabled && (isAdmin || isLawyer)
      ? { label: "Dividends", route: "/equity/dividend_rounds" }
      : isInvestor
        ? { label: "Dividends", route: "/equity/dividends" }
        : null,
    company.equityEnabled && (isAdmin || isInvestor) ? { label: "Buybacks", route: "/equity/tender_offers" } : null,
  ];
  return links.filter((link) => !!link);
};
