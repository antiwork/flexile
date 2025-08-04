"use client";
import { CircleCheck, Plus, Clock, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
// import { useCurrentCompany } from "@/global";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import NewDistributionModal from "./NewDistributionModal";
import { unifiedData, type UnifiedDividendRound, DIVIDEND_ROUND_STATUS } from "./mock_data";
import { capitalize } from "lodash-es";

const STATUS_ICONS = {
  [DIVIDEND_ROUND_STATUS.DRAFT]: <Circle className="size-4 text-black/18" />,
  [DIVIDEND_ROUND_STATUS.PAYMENT_SCHEDULED]: <Clock className="size-4 text-blue-600" />,
  [DIVIDEND_ROUND_STATUS.PAYMENT_IN_PROGRESS]: <Circle className="size-4 text-blue-600" />,
  [DIVIDEND_ROUND_STATUS.PARTIALLY_COMPLETED]: <AlertCircle className="text-orange size-4" />,
  [DIVIDEND_ROUND_STATUS.COMPLETED]: <CheckCircle2 className="text-green size-4" />,
} as const;

function formatStatus(status: string) {
  return capitalize(status.replace(/_/gu, " "));
}

const data = unifiedData;

export default function DividendRounds() {
  // const company = useCurrentCompany();
  const router = useRouter();
  const [isNewDistributionModalOpen, setIsNewDistributionModalOpen] = useState(false);
  // const { data: dividendRounds = [], isLoading } = trpc.dividendRounds.list.useQuery({ companyId: company.id });

  const columnHelper = createColumnHelper<UnifiedDividendRound>();
  const columns = [
    columnHelper.accessor("name", {
      header: "Name",
      cell: (info) => (
        <Link href={`/equity/dividend_rounds/${info.row.original.id}`} className="no-underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("returnOfCapital", {
      header: "Type",
      cell: (info) => (info.getValue() ? "Return of capital" : "Dividend"),
      meta: {
        filterOptions: ["Return of capital", "Dividend"],
      },
      filterFn: (row, _, filterValue) =>
        Array.isArray(filterValue) &&
        filterValue.includes(row.original.returnOfCapital ? "Return of capital" : "Dividend"),
    }),
    columnHelper.accessor("dividendsIssuanceDate", {
      header: "Payment date",
      cell: (info) => formatDate(info.getValue()),
      meta: {
        filterOptions: [...new Set(data.map((round) => round.dividendsIssuanceDate.getFullYear().toString()))],
      },
      filterFn: (row, _, filterValue) =>
        Array.isArray(filterValue) && filterValue.includes(row.original.dividendsIssuanceDate.getFullYear().toString()),
    }),
    columnHelper.simple("totalAmountInCents", "Amount", formatMoneyFromCents, "numeric"),
    columnHelper.simple("numberOfShareholders", "Stakeholders", (value) => value.toLocaleString(), "numeric"),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => {
        const status = info.getValue();

        return (
          <div className="flex items-center gap-2">
            {STATUS_ICONS[status as keyof typeof STATUS_ICONS]}
            <span>{formatStatus(status)}</span>
          </div>
        );
      },
      meta: {
        filterOptions: Object.values(DIVIDEND_ROUND_STATUS).map(formatStatus),
      },
      filterFn: (row, _, filterValue) =>
        Array.isArray(filterValue) && filterValue.includes(formatStatus(row.original.status)),
    }),
  ];

  const table = useTable({
    columns,
    data,
    enableGlobalFilter: true,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [
        // Newest first
        {
          id: "dividendsIssuanceDate",
          desc: true,
        },
      ],
    },
  });

  return (
    <>
      <DashboardHeader title="Dividends" />
      {false ? (
        <TableSkeleton columns={3} />
      ) : data.length > 0 ? (
        <DataTable
          searchColumn="name"
          table={table}
          onRowClicked={(row) => router.push(`/equity/dividend_rounds/${row.id}`)}
          actions={
            <Button variant="outline" size="small" onClick={() => setIsNewDistributionModalOpen(true)}>
              <Plus className="size-4" />
              New distribution
            </Button>
          }
        />
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>You have not issued any dividends yet.</Placeholder>
        </div>
      )}

      <NewDistributionModal open={isNewDistributionModalOpen} onOpenChange={setIsNewDistributionModalOpen} />
    </>
  );
}

// Sorting function for dividend rounds.
// Computations are sorted first, then by payment date descending.
// const sortingFn: SortingFn<DividendRound> = (rowA, rowB) => {
//   const a = rowA.original;
//   const b = rowB.original;

//   const aIsDraft = a.type === "computation";
//   const bIsDraft = b.type === "computation";

//   if (aIsDraft && !bIsDraft) return -1;
//   if (!aIsDraft && bIsDraft) return 1;

//   const dateA = new Date(a.dividendsIssuanceDate);
//   const dateB = new Date(b.dividendsIssuanceDate);

//   return dateB.getTime() - dateA.getTime();
// };
