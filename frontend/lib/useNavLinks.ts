"use client";

import { skipToken } from "@tanstack/react-query";
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
import React from "react";
import { navLinks as equityNavLinks } from "@/app/(dashboard)/equity";
import { useIsActionable } from "@/app/(dashboard)/invoices";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { getVisibleSettingsLinks } from "@/lib/settingsNavLinks";
import { storageKeys } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { useIsMobile } from "@/utils/use-mobile";

export interface NavLinkInfo {
  label: string;
  route?: string;
  icon?: LucideIcon | React.ComponentType;
  isActive?: boolean;
  badge?: number;
  subItems?: { label: string; route: string; icon?: LucideIcon }[];
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export const hasSubItems = (
  item: NavLinkInfo,
): item is NavLinkInfo & { subItems: NonNullable<NavLinkInfo["subItems"]> } =>
  !!item.subItems && item.subItems.length > 0;

export const useNavLinks = (): NavLinkInfo[] => {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = useCurrentCompany();

  const [openStates, setOpenStates] = React.useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};

    const equityState = localStorage.getItem(storageKeys.EQUITY_MENU_STATE);
    const settingsState = localStorage.getItem(storageKeys.SETTINGS_MENU_STATE);
    states.Equity = equityState === "open";
    states.Settings = settingsState === "open";
    return states;
  });

  const createToggleHandler = (label: string, storageKey: string) => (isOpen: boolean) => {
    setOpenStates((prev) => ({ ...prev, [label]: isOpen }));
    localStorage.setItem(storageKey, isOpen ? "open" : "closed");
  };

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
      ? {
          companyId: user.currentCompanyId,
          userId: user.roles.administrator || user.roles.lawyer ? null : user.id,
          signable: true,
        }
      : skipToken,
    { refetchInterval: 30_000 },
  );

  const updatesPath = company.routes.find((route) => route.label === "Updates")?.name;
  const equityLinks = equityNavLinks(user, company);

  const navLinks: NavLinkInfo[] = [];

  if (updatesPath) {
    navLinks.push({
      label: "Updates",
      route: "/updates/company" as const,
      icon: Rss,
      isActive: pathname.startsWith("/updates"),
    });
  }

  if (routes.has("Invoices")) {
    navLinks.push({
      label: "Invoices",
      route: "/invoices" as const,
      icon: ReceiptIcon,
      isActive: pathname.startsWith("/invoices"),
      badge: invoicesData?.filter(isInvoiceActionable).length ?? 0,
    });
  }

  if (routes.has("Expenses") && company.id) {
    navLinks.push({
      label: "Expenses",
      route: `/companies/${company.id}/expenses` as const,
      icon: CircleDollarSign,
      isActive: pathname.startsWith(`/companies/${company.id}/expenses`),
    });
  }

  if (routes.has("Documents")) {
    navLinks.push({
      label: "Documents",
      route: "/documents" as const,
      icon: Files,
      isActive: pathname.startsWith("/documents") || pathname.startsWith("/document_templates"),
      badge: documentsData?.length ?? 0,
    });
  }

  if (routes.has("People")) {
    navLinks.push({
      label: "People",
      route: "/people" as const,
      icon: Users,
      isActive: pathname.startsWith("/people") || pathname.includes("/investor_entities/"),
    });
  }

  if (routes.has("Roles")) {
    navLinks.push({
      label: "Roles",
      route: "/roles" as const,
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
      isOpen: openStates.Equity ?? false,
      onToggle: createToggleHandler("Equity", storageKeys.EQUITY_MENU_STATE),
    });
  }

  const settingsNavLinks = getVisibleSettingsLinks(user);
  if (isMobile && settingsNavLinks.length > 0) {
    navLinks.push({
      label: "Settings",
      icon: Settings,
      isActive: pathname.startsWith("/settings"),
      subItems: settingsNavLinks,
      isOpen: openStates.Settings ?? false,
    });
  }

  return navLinks;
};
