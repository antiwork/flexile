import { Briefcase, Building, CreditCard, Landmark, PieChart, ScrollText, ShieldUser, UserCircle2 } from "lucide-react";
import type { CurrentUser } from "@/models/user";

export const personalLinks = [
  {
    label: "Profile",
    route: "/settings" as const,
    icon: UserCircle2,
    isVisible: (_user: CurrentUser) => true,
  },
  {
    label: "Payouts",
    route: "/settings/payouts" as const,
    icon: Landmark,
    isVisible: (user: CurrentUser) => !!user.roles.worker || !!user.roles.investor,
  },
  {
    label: "Tax information",
    route: "/settings/tax" as const,
    icon: ScrollText,
    isVisible: (user: CurrentUser) => !!user.roles.worker || !!user.roles.investor,
  },
];

export const companyLinks = [
  {
    label: "Workspace settings",
    route: "/settings/administrator" as const,
    icon: Building,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Workspace admins",
    route: "/settings/administrator/admins" as const,
    icon: ShieldUser,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Company details",
    route: "/settings/administrator/details" as const,
    icon: Briefcase,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Billing",
    route: "/settings/administrator/billing" as const,
    icon: CreditCard,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
  {
    label: "Equity value",
    route: "/settings/administrator/equity" as const,
    icon: PieChart,
    isVisible: (user: CurrentUser) => !!user.roles.administrator,
  },
];
