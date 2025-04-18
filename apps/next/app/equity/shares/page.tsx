"use client";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import React from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Figures from "@/components/Figures";
import Placeholder from "@/components/Placeholder";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatOwnershipPercentage } from "@/utils/numbers";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

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
  const [shareHoldings] = trpc.shareHoldings.list.useSuspenseQuery({
    companyId: company.id,
    investorId: user.roles.investor?.id ?? "",
  });

  const table = useTable({ data: shareHoldings, columns });

  const totalShares = shareHoldings.reduce((acc, share) => acc + share.numberOfShares, 0);
  const equityValueUsd =
    company.valuationInDollars && company.fullyDilutedShares
      ? (company.valuationInDollars / company.fullyDilutedShares) * totalShares
      : 0;
  const equityValueLabel = `Equity value ($${(company.valuationInDollars || 0).toLocaleString([], { notation: "compact" })} valuation)`;
  const ownership = company.fullyDilutedShares ? totalShares / company.fullyDilutedShares : 0;

  return (
    <EquityLayout>
      {shareHoldings.length > 0 ? (
        <>
          <Figures
            items={[
              { caption: "Total shares", value: totalShares.toLocaleString() },
              { caption: equityValueLabel, value: formatMoney(equityValueUsd) },
              { caption: "Ownership", value: formatOwnershipPercentage(ownership) },
            ]}
          />
          <DataTable table={table} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>You do not hold any shares.</Placeholder>
      )}
    </EquityLayout>
  );
}
