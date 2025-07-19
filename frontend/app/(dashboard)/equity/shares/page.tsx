"use client";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import React from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { usePathname } from "next/navigation";
import { navLinks } from "@/app/(dashboard)/equity";
import { DashboardHeader } from "@/components/DashboardHeader";

const columnHelper = createColumnHelper<RouterOutput["shareHoldings"]["list"][number]>();
const columns = [
  columnHelper.simple("issuedAt", "Issue date", formatDate),
  columnHelper.simple("shareClassName", "Type"),
  columnHelper.simple("numberOfShares", "Number of shares", (value) => value.toLocaleString(), "numeric"),
  columnHelper.simple("sharePriceUsd", "Share price", (value) => formatMoney(value, { precise: true }), "numeric"),
  columnHelper.simple("totalAmountInCents", "Cost", formatMoneyFromCents, "numeric"),
];

export default function Shares() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const pathname = usePathname();
  const { data: shareHoldings = [], isLoading } = trpc.shareHoldings.list.useQuery({
    companyId: company.id,
    investorId: user.roles.investor?.id ?? "",
  });

  const table = useTable({ data: shareHoldings, columns });
  const currentLink = navLinks(user, company).find((link) => link.route === pathname);

  return (
    <>
      {!!currentLink && (
        <DashboardHeader
          title={"Equity"}
          showBreadcrumb
          breadcrumbLinks={{ label: currentLink.label, href: currentLink.route }}
        />
      )}

      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : shareHoldings.length > 0 ? (
        <DataTable table={table} />
      ) : (
        <Placeholder icon={CheckCircleIcon}>You do not hold any shares.</Placeholder>
      )}
    </>
  );
}
