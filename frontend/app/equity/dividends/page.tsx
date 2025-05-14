"use client";
import { CheckCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import React from "react";
import DividendStatusIndicator from "@/app/equity/DividendStatusIndicator";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { linkClasses } from "@/components/Link";

type Dividend = RouterOutput["dividends"]["list"][number];
const columnHelper = createColumnHelper<Dividend>();
const columns = [
  columnHelper.simple("dividendRound.issuedAt", "Issue date", formatDate),
  columnHelper.simple("numberOfShares", "Shares", (value) => value?.toLocaleString() ?? "N/A", "numeric"),
  columnHelper.simple("totalAmountInCents", "Amount", (value) => formatMoneyFromCents(value), "numeric"),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Tooltip>
        <TooltipTrigger>
          <DividendStatusIndicator status={info.getValue()} />
        </TooltipTrigger>
        <TooltipContent>
          {info.getValue() === "Retained"
            ? info.row.original.retainedReason === "ofac_sanctioned_country"
              ? "This dividend is retained due to sanctions imposed on your residence country."
              : info.row.original.retainedReason === "below_minimum_payment_threshold"
                ? "This dividend doesn't meet the payout threshold set in your settings."
                : null
            : null}
        </TooltipContent>
      </Tooltip>
    ),
  }),
];
export default function Dividends() {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [data] = trpc.dividends.list.useSuspenseQuery({
    companyId: company.id,
    investorId: user.roles.investor?.id,
  });

  const table = useTable({ columns, data });

  return (
    <EquityLayout>
      {user.hasPayoutMethod ? null : (
        <Alert>
          <InformationCircleIcon />
          <AlertDescription>
            Please{" "}
            <Link className={linkClasses} href="/settings/payouts">
              provide a payout method
            </Link>{" "}
            for your dividends.
          </AlertDescription>
        </Alert>
      )}
      {data.length > 0 ? (
        <DataTable table={table} />
      ) : (
        <Placeholder icon={CheckCircleIcon}>You have not been issued any dividends yet.</Placeholder>
      )}
    </EquityLayout>
  );
}
