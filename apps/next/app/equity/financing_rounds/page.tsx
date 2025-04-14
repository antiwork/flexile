"use client";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { getExpandedRowModel } from "@tanstack/react-table";
import React, { useMemo } from "react";
import Placeholder from "@/components/Placeholder";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

type FinancingRound = RouterOutput["financingRounds"]["list"][number];
type Investor = FinancingRound["investors"][number];

export default function FinancingRounds() {
  const company = useCurrentCompany();
  const [data] = trpc.financingRounds.list.useSuspenseQuery({ companyId: company.id });

  const isFinancingRound = (row: FinancingRound | Investor): row is FinancingRound => "investors" in row;

  const columnHelper = createColumnHelper<FinancingRound | Investor>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Round",
        cell: ({ row }) =>
          isFinancingRound(row.original) && row.original.investors.length > 0 ? (
            <button onClick={row.getToggleExpandedHandler()} className="flex items-center">
              {row.getIsExpanded() ? <ChevronUpIcon className="size-5" /> : <ChevronDownIcon className="size-5" />}
              <b>{row.original.name}</b>
            </button>
          ) : isFinancingRound(row.original) ? (
            <span>
              <b>{row.original.name}</b>
            </span>
          ) : (
            <span className="ml-4">{row.original.name}</span>
          ),
        footer: () => <b>Total</b>,
      }),
      columnHelper.accessor("issuedAt", {
        header: "Date",
        cell: (info) => (isFinancingRound(info.row.original) ? formatDate(info.row.original.issuedAt) : undefined),
      }),
      columnHelper.accessor("sharesIssued", {
        header: "Shares issued",
        cell: (info) =>
          isFinancingRound(info.row.original) ? info.row.original.sharesIssued.toLocaleString() : undefined,
        meta: { numeric: true },
        footer: () => <b>{data.reduce((acc, round) => acc + round.sharesIssued, 0n).toLocaleString()}</b>,
      }),
      columnHelper.accessor("pricePerShareCents", {
        header: "Price per share",
        cell: (info) =>
          isFinancingRound(info.row.original) ? formatMoneyFromCents(info.row.original.pricePerShareCents) : undefined,
        meta: { numeric: true },
      }),
      columnHelper.accessor((row) => (isFinancingRound(row) ? row.amountRaisedCents : row.amount_invested_cents), {
        header: "Amount raised",
        cell: (info) => formatMoneyFromCents(info.getValue()),
        meta: { numeric: true },
        footer: () => <b>{formatMoneyFromCents(data.reduce((acc, round) => acc + round.amountRaisedCents, 0n))}</b>,
      }),
      columnHelper.accessor("postMoneyValuationCents", {
        header: "Post-money valuation",
        cell: (info) =>
          isFinancingRound(info.row.original)
            ? formatMoneyFromCents(info.row.original.postMoneyValuationCents)
            : undefined,
        meta: { numeric: true },
      }),
    ],
    [data],
  );

  const table = useTable({
    columns,
    data,
    getSubRows: (row) => (isFinancingRound(row) ? row.investors : undefined),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: { expanded: true },
  });

  return (
    <EquityLayout>
      {data.length > 0 ? (
        <Table table={table} />
      ) : (
        <Placeholder icon={CheckCircleIcon}>There are no financing rounds recorded yet.</Placeholder>
      )}
    </EquityLayout>
  );
}
