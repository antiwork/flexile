"use client";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import React from "react";
import Figures from "@/components/Figures";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import Placeholder from "@/components/Placeholder";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatOwnershipPercentage } from "@/utils/numbers";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

const columnHelper =
  createColumnHelper<RouterOutput["convertibleSecurities"]["list"]["convertibleSecurities"][number]>();
const columns = [
  columnHelper.simple("issuedAt", "Issue date", formatDate),
  columnHelper.simple("convertibleType", "Type"),
  columnHelper.simple("companyValuationInDollars", "Pre-money valuation cap", (value) => formatMoney(value), "numeric"),
  columnHelper.simple("principalValueInCents", "Investment amount", (value) => formatMoneyFromCents(value), "numeric"),
];

export default function Convertibles() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [page] = usePage();
  const perPage = 50;
  const [data] = trpc.convertibleSecurities.list.useSuspenseQuery({
    companyId: company.id,
    investorId: user.roles.investor?.id ?? "",
    perPage,
    page,
  });

  const table = useTable({ columns, data: data.convertibleSecurities });

  const companyValuation = Intl.NumberFormat([], { notation: "compact" }).format(company.valuationInDollars ?? 0);

  return (
    <EquityLayout>
      {data.totalCount > 0 && company.valuationInDollars !== 0 && company.fullyDilutedShares !== 0 ? (
        <Figures
          items={[
            { caption: "Investment amount", value: formatMoneyFromCents(data.totalPrincipalValueInCents) },
            { caption: "Public valuation cap", value: companyValuation },
            company.fullyDilutedShares !== null
              ? {
                  caption: "Implied ownership",
                  value: formatOwnershipPercentage(data.totalImpliedShares / company.fullyDilutedShares),
                }
              : null,
          ].filter((item) => !!item)}
        />
      ) : null}
      {data.convertibleSecurities.length > 0 ? (
        <>
          <DataTable table={table} />
          <PaginationSection total={data.totalCount} perPage={perPage} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>You do not hold any convertible securities.</Placeholder>
      )}
    </EquityLayout>
  );
}
