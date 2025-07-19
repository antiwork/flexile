import type { TabLink } from "@/components/Tabs";
import { type CurrentUser } from "@/models/user";

export const navLinks = (user: CurrentUser): TabLink[] => {
  const isAdmin = !!user.roles.administrator;
  const isLawyer = !!user.roles.lawyer;
  const isInvestor = !!user.roles.investor;
  const links: TabLink[] = [];
  if (isAdmin || isLawyer || isInvestor) links.push({ label: "Cap table", route: "/equity/cap_table" });
  if (isAdmin || isLawyer) links.push({ label: "Option pools", route: "/equity/option_pools" });
  if (isAdmin || isLawyer) links.push({ label: "Equity grants", route: "/equity/grants" });
  if (isInvestor && user.roles.investor?.hasGrants) links.push({ label: "Options", route: "/equity/options" });
  if (isInvestor && user.roles.investor?.hasShares) links.push({ label: "Shares", route: "/equity/shares" });
  if (isInvestor && user.roles.investor?.hasConvertibles)
    links.push({ label: "Convertibles", route: "/equity/convertibles" });
  if (isInvestor) links.push({ label: "Dividends", route: "/equity/dividends" });
  else if (isAdmin || isLawyer) links.push({ label: "Dividends", route: "/equity/dividend_rounds" });
  if (isAdmin || isInvestor) links.push({ label: "Buybacks", route: "/equity/tender_offers" });
  return links;
};
