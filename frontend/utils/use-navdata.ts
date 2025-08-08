import { skipToken, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { navLinks as equityNavLinks } from "@/app/(dashboard)/equity";
import { useIsActionable } from "@/app/(dashboard)/invoices";
import { useCurrentCompany, useCurrentUser, useUserStore } from "@/global";
import { storageKeys } from "@/models/constants";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_switch_path } from "@/utils/routes";

export function useNavData() {
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useUserStore();

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

  const [isOpen, setIsOpen] = React.useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(storageKeys.EQUITY_MENU_STATE) === "open";
    } catch {
      return false;
    }
  });

  const switchCompany = async (companyId: string) => {
    useUserStore.setState((state) => ({ ...state, pending: true }));
    try {
      await request({
        method: "POST",
        url: company_switch_path(companyId),
        accept: "json",
      });
      await queryClient.resetQueries({ queryKey: ["currentUser", user.email] });
      router.refresh();
    } catch (_error) {
      // TODO (techdebt): Add user-facing error notification for company switch failure
    } finally {
      useUserStore.setState((state) => ({ ...state, pending: false }));
    }
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
    logout,
  };
}
