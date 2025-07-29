import { skipToken, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import React from "react";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";
import { navLinks as equityNavLinks } from "../app/(dashboard)/equity";
import { useIsActionable } from "../app/(dashboard)/invoices";
import { useCurrentCompany, useCurrentUser, useUserStore } from "../global";
import { storageKeys } from "../models/constants";
import { trpc } from "../trpc/client";

export function useNavData() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const pathname = usePathname();
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
  const [isOpen, setIsOpen] = React.useState(() => localStorage.getItem(storageKeys.EQUITY_MENU_STATE) === "open");
  const queryClient = useQueryClient();
  const switchCompany = async (companyId: string) => {
    useUserStore.setState((state) => ({ ...state, pending: true }));
    await request({
      method: "POST",
      url: company_switch_path(companyId),
      accept: "json",
    });
    await queryClient.resetQueries({ queryKey: ["currentUser"] });
    useUserStore.setState((state) => ({ ...state, pending: false }));
  };

  return {
    user,
    company,
    pathname,
    routes,
    invoicesData,
    isInvoiceActionable,
    documentsData,
    updatesPath,
    equityLinks,
    isOpen,
    setIsOpen,
    switchCompany,
  };
}
