"use client";

import { useIsActionable } from "@/app/invoices";
import { navLinks as equityNavLinks } from "@/app/equity";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import {
  BookUser,
  ChartPie,
  CircleDollarSign,
  Files,
  type LucideIcon,
  ReceiptIcon,
  Rss,
  Settings,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { skipToken } from "@tanstack/react-query";

export interface NavLinkInfo {
  label: string;
  href?: string;
  icon: LucideIcon;
  isActive: boolean;
  badge?: number;
  subItems?: { label: string; route: string }[];
}

export const hasSubItems = (
  item: NavLinkInfo,
): item is NavLinkInfo & { subItems: NonNullable<NavLinkInfo["subItems"]> } =>
  !!item.subItems && item.subItems.length > 0;

export const useNavLinks = (): NavLinkInfo[] => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = useCurrentCompany();

  const routes = new Set(
    company.routes.flatMap((route) => [route.label, ...(route.subLinks?.map((subLink) => subLink.label) || [])]),
  );

  const { data: invoicesData } = trpc.invoices.list.useQuery(
    user.currentCompanyId && user.roles.administrator
      ? { companyId: user.currentCompanyId, status: ["received", "approved", "failed"] }
      : skipToken,
    { refetchInterval: 30_000 },
  );
  const isInvoiceActionable = useIsActionable();

  const { data: documentsData } = trpc.documents.list.useQuery(
    user.currentCompanyId && user.id
      ? { companyId: user.currentCompanyId, userId: user.id, signable: true }
      : skipToken,
    { refetchInterval: 30_000 },
  );

  const updatesPath = company.routes.find((route) => route.label === "Updates")?.name;
  const equityLinks = equityNavLinks(user, company);

  const navLinks: NavLinkInfo[] = [];

  if (updatesPath) {
    navLinks.push({
      label: "Updates",
      href: "/updates/company",
      icon: Rss,
      isActive: pathname.startsWith("/updates"),
    });
  }

  if (routes.has("Invoices")) {
    navLinks.push({
      label: "Invoices",
      href: "/invoices",
      icon: ReceiptIcon,
      isActive: pathname.startsWith("/invoices"),
      badge: invoicesData?.filter(isInvoiceActionable).length ?? 0,
    });
  }

  if (routes.has("Expenses") && company.id) {
    navLinks.push({
      label: "Expenses",
      href: `/companies/${company.id}/expenses`,
      icon: CircleDollarSign,
      isActive: pathname.startsWith(`/companies/${company.id}/expenses`),
    });
  }

  if (routes.has("Documents")) {
    navLinks.push({
      label: "Documents",
      href: "/documents",
      icon: Files,
      isActive: pathname.startsWith("/documents") || pathname.startsWith("/document_templates"),
      badge: documentsData?.length ?? 0,
    });
  }

  if (routes.has("People")) {
    navLinks.push({
      label: "People",
      href: "/people",
      icon: Users,
      isActive: pathname.startsWith("/people") || pathname.includes("/investor_entities/"),
    });
  }

  if (routes.has("Roles")) {
    navLinks.push({
      label: "Roles",
      href: "/roles",
      icon: BookUser,
      isActive: pathname.startsWith("/roles"),
    });
  }

  if (routes.has("Equity") && equityLinks.length > 0) {
    navLinks.push({
      label: "Equity",
      icon: ChartPie,
      isActive: equityLinks.some((link) => pathname === link.route),
      subItems: equityLinks,
    });
  }

  navLinks.push({
    label: "Settings",
    href: "/settings",
    icon: Settings,
    isActive: pathname.startsWith("/settings"),
  });

  return navLinks;
};
