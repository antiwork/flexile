"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import DividendStatusIndicator from "@/app/equity/DividendStatusIndicator";
import Figures from "@/components/Figures";
import MainLayout from "@/components/layouts/Main";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";

type Dividend = RouterOutput["dividends"]["list"]["dividends"][number];
const rowLink = (row: Dividend) => `/people/${row.investor.user.id}?tab=dividends` as const;
const columnHelper = createColumnHelper<Dividend>();
const columns = [
  columnHelper.accessor("investor.user.name", {
    header: "Recipient",
    cell: (info) => (
      <Link href={rowLink(info.row.original)} className="no-underline">
        <strong>{info.getValue()}</strong>
      </Link>
    ),
  }),
  columnHelper.simple("numberOfShares", "Shares", (value) => value?.toLocaleString(), "numeric"),
  columnHelper.simple("totalAmountInCents", "Amount", formatMoneyFromCents, "numeric"),
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
              ? "This dividend is retained due to sanctions imposed on the investor's residence country."
              : info.row.original.retainedReason === "below_minimum_payment_threshold"
                ? "This dividend doesn't meet the payout threshold set by the investor."
                : null
            : null}
        </TooltipContent>
      </Tooltip>
    ),
  }),
];

const perPage = 50;
export default function DividendRound() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const router = useRouter();
  const [page] = usePage();
  const [dividendRound] = trpc.dividendRounds.get.useSuspenseQuery({ companyId: company.id, id: Number(id) });
  const [dividendsData] = trpc.dividends.list.useSuspenseQuery({
    companyId: company.id,
    dividendRoundId: Number(id),
    perPage,
    page,
  });

  const table = useTable({ columns, data: dividendsData.dividends });

  return (
    <MainLayout title="Dividend">
      <Figures
        items={[
          { caption: "Dividend amount", value: formatMoneyFromCents(dividendRound.totalAmountInCents) },
          { caption: "Shareholders", value: dividendRound.numberOfShareholders.toLocaleString() },
          { caption: "Date", value: formatDate(dividendRound.issuedAt) },
        ]}
      />
      <DataTable table={table} onRowClicked={(row) => router.push(rowLink(row))} />
      <PaginationSection total={dividendsData.total} perPage={perPage} />
    </MainLayout>
  );
}
