import {
  Briefcase,
  Building2,
  Building,
  ChartPie,
  CreditCard,
  Files,
  House,
  Landmark,
  type LucideIcon,
  PieChart,
  Receipt,
  Rss,
  ScrollText,
  Settings,
  ShieldUser,
  UserCircle2,
  UserRoundCog,
  Users,
} from "lucide-react";
import type { Route } from "next";
import type { Company, CurrentUser } from "@/models/user";

export interface NavChildrenType {
  label: string;
  route: Route;
  icon?: LucideIcon;
  isVisible: boolean;
  isActive: boolean;
}

export interface NavType {
  label: string;
  route: Route;
  icon: LucideIcon;
  isVisible: boolean;
  isActive: boolean;
  badge?: number;
  children?: NavChildrenType[];
  tabPriority: number; // Priority flag for mobile navigation
}

export const getNavEquity = (user: CurrentUser, company: Company, pathname: string) => {
  const isAdmin = !!user.roles.administrator;
  const isLawyer = !!user.roles.lawyer;
  const isInvestor = !!user.roles.investor;
  const { flags } = company;

  const nav: NavChildrenType[] = [
    {
      label: "Investors",
      route: "/equity/investors",
      isVisible: flags.includes("equity") && (isAdmin || isLawyer || isInvestor),
      isActive: pathname === "/equity/investors",
    },
    {
      label: "Option pools",
      route: "/equity/option_pools",
      isVisible: flags.includes("equity") && (isAdmin || isLawyer),
      isActive: pathname === "/equity/option_pools",
    },
    {
      label: "Equity grants",
      route: "/equity/grants",
      isVisible: flags.includes("equity") && (isAdmin || isLawyer),
      isActive: pathname === "/equity/grants",
    },
    {
      label: "Options",
      route: "/equity/options",
      isVisible: flags.includes("equity") && isInvestor && !!user.roles.investor?.hasGrants,
      isActive: pathname === "/equity/options",
    },
    {
      label: "Shares",
      route: "/equity/shares",
      isVisible: isInvestor && !!user.roles.investor?.hasShares,
      isActive: pathname === "/equity/shares",
    },
    {
      label: "Convertibles",
      route: "/equity/convertibles",
      isVisible: isInvestor && !!user.roles.investor?.hasConvertibles,
      isActive: pathname === "/equity/convertibles",
    },
    {
      label: "Dividends",
      route: `/equity/${isInvestor ? "dividends" : "dividend_rounds"}`,
      isVisible: isInvestor || (flags.includes("equity") && (isAdmin || isLawyer)),
      isActive: pathname === `/equity/${isInvestor ? "dividends" : "dividend_rounds"}`,
    },
    {
      label: "Buybacks",
      route: "/equity/tender_offers",
      isVisible: flags.includes("equity") && (isAdmin || isInvestor),
      isActive: pathname === "/equity/tender_offers",
    },
  ];

  return nav.filter((link) => link.isVisible);
};

export const getNavMain = (
  user: CurrentUser,
  company: Company,
  pathname: string,
  otherInfo: { badge: { invoices: number; documents: number } },
) => {
  const routes = new Set(
    company.routes.flatMap((route) => [route.label, ...(route.subLinks?.map((subLink) => subLink.label) || [])]),
  );
  const equityChildren = getNavEquity(user, company, pathname);
  const nav: NavType[] = [
    {
      label: "Updates",
      route: "/updates/company",
      icon: Rss,
      isVisible: routes.has("Updates"),
      isActive: pathname.startsWith("/updates"),
      tabPriority: 4,
    },
    {
      label: "Invoices",
      route: "/invoices",
      icon: Receipt,
      isVisible: routes.has("Invoices"),
      isActive: pathname.startsWith("/invoices"),
      badge: otherInfo.badge.invoices,
      tabPriority: 1,
    },
    {
      label: "Documents",
      route: "/documents",
      icon: Files,
      isVisible: routes.has("Documents"),
      isActive: pathname.startsWith("/documents") || pathname.startsWith("/document_templates"),
      badge: otherInfo.badge.documents,
      tabPriority: 2,
    },
    {
      label: "People",
      route: "/people",
      icon: Users,
      isVisible: routes.has("People"),
      isActive: pathname.startsWith("/people") || pathname.includes("/investor_entities/"),
      tabPriority: 5,
    },
    {
      label: "Equity",
      route: "#",
      icon: ChartPie,
      isVisible: routes.has("Equity") && equityChildren.length > 0,
      isActive: pathname.startsWith("/equity"),
      children: equityChildren,
      tabPriority: 3,
    },
    {
      label: "Settings",
      route: "/settings",
      icon: Settings,
      isVisible: true,
      isActive: pathname.startsWith("/settings"),
      tabPriority: 6,
    },
  ];

  return nav.filter((link) => link.isVisible);
};

export const getNavPersonalSettings = (user: CurrentUser, pathname: string) => {
  const nav: NavChildrenType[] = [
    {
      label: "Profile",
      route: "/settings",
      icon: UserCircle2,
      isVisible: true,
      isActive: pathname === "/settings",
    },
    {
      label: "Payouts",
      route: "/settings/payouts",
      icon: Landmark,
      isVisible: !!user.roles.worker || !!user.roles.investor,
      isActive: pathname === "/settings/payouts",
    },
    {
      label: "Tax information",
      route: "/settings/tax",
      icon: ScrollText,
      isVisible: !!user.roles.worker || !!user.roles.investor,
      isActive: pathname === "/settings/tax",
    },
  ];

  return nav.filter((link) => link.isVisible);
};

export const getNavCompanySettings = (user: CurrentUser, pathname: string) => {
  const nav: NavChildrenType[] = [
    {
      label: "Workspace settings",
      route: "/settings/administrator",
      icon: Building,
      isVisible: !!user.roles.administrator,
      isActive: pathname === "/settings/administrator",
    },
    {
      label: "Workspace admins",
      route: "/settings/administrator/admins",
      icon: ShieldUser,
      isVisible: !!user.roles.administrator,
      isActive: pathname === "/settings/administrator/admins",
    },
    {
      label: "Company details",
      route: "/settings/administrator/details",
      icon: Briefcase,
      isVisible: !!user.roles.administrator,
      isActive: pathname === "/settings/administrator/details",
    },
    {
      label: "Billing",
      route: "/settings/administrator/billing",
      icon: CreditCard,
      isVisible: !!user.roles.administrator,
      isActive: pathname === "/settings/administrator/billing",
    },
    {
      label: "Equity",
      route: "/settings/administrator/equity",
      icon: PieChart,
      isVisible: !!user.roles.administrator,
      isActive: pathname === "/settings/administrator/equity",
    },
  ];
  return nav.filter((link) => link.isVisible);
};

export const getNavSettings = (user: CurrentUser, pathname: string) => {
  const personalSettingsChildren = getNavPersonalSettings(user, pathname);
  const companySettingsChildren = getNavCompanySettings(user, pathname);

  const nav: NavType[] = [
    {
      label: "Home",
      route: "/dashboard",
      icon: House,
      isVisible: true,
      isActive: pathname === "/dashboard",
      tabPriority: 1,
    },
    {
      label: "Personal",
      route: "#",
      icon: UserRoundCog,
      isVisible: personalSettingsChildren.length > 0,
      isActive: pathname.startsWith("/settings") && !pathname.startsWith("/settings/administrator"),
      children: personalSettingsChildren,
      tabPriority: 2,
    },
    {
      label: "Company",
      route: "#",
      icon: Building2,
      isVisible: companySettingsChildren.length > 0,
      isActive: pathname.startsWith("/settings/administrator"),
      children: companySettingsChildren,
      tabPriority: 3,
    },
  ];

  return nav.filter((link) => link.isVisible);
};
