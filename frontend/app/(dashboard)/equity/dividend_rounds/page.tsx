"use client";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { capitalize } from "lodash-es";
import { CheckCircle2, Circle, CircleCheck, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import NewDistributionModal from "./NewDistributionModal";

type DividendOrComputation = {
  id: bigint;
  totalAmountInUsd: string;
  numberOfShareholders: bigint;
  returnOfCapital: boolean;
  dividendsIssuanceDate: Date;
  type: "round" | "draft";
  status: string;
};

export default function DividendRounds() {
  const company = useCurrentCompany();

  const { data: dividendComputations = [], isLoading: isLoadingDividendComputations } =
    trpc.dividendComputations.list.useQuery(
      { companyId: company.id },
      {
        select: (computations) =>
          computations.map((computation) => ({
            ...computation,
            type: "draft" as const,
            status: "Draft",
            dividendsIssuanceDate: new Date(computation.dividendsIssuanceDate),
            numberOfShareholders: BigInt(computation.numberOfShareholders),
          })),
      },
    );
  const { data: dividendRounds = [], isLoading: isLoadingDividendRounds } = trpc.dividendRounds.list.useQuery(
    { companyId: company.id },
    {
      select: (rounds) =>
        rounds.map((round) => ({
          ...round,
          type: "round" as const,
          dividendsIssuanceDate: round.issuedAt,
          totalAmountInUsd: String(round.totalAmountInCents / 100n),
        })),
    },
  );
  const isLoading = isLoadingDividendComputations || isLoadingDividendRounds;
  const data: DividendOrComputation[] = [...dividendComputations, ...dividendRounds];
  const router = useRouter();
  const [isNewDistributionModalOpen, setIsNewDistributionModalOpen] = useState(false);

  const columnHelper = createColumnHelper<DividendOrComputation>();
  const columns = [
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
    columnHelper.simple("totalAmountInUsd", "Amount", formatMoney, "numeric"),
    columnHelper.simple("numberOfShareholders", "Stakeholders", (value) => value.toLocaleString(), "numeric"),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => {
        const status = info.getValue();
        const { Icon, color } = getStatus(status);

        return (
          <div className="flex items-center gap-2">
            <Icon className={`size-4 ${color}`} />
            <span>{formatStatus(status)}</span>
          </div>
        );
      },
      meta: {
        filterOptions: [...new Set(data.map((round) => round.status))].map(formatStatus),
      },
      filterFn: (row, _, filterValue) =>
        Array.isArray(filterValue) && filterValue.includes(formatStatus(row.original.status)),
    }),
  ];

  const table = useTable({
    columns,
    data,
    enableGlobalFilter: false,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [
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
      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : data.length > 0 ? (
        <DataTable
          table={table}
          onRowClicked={(row) => router.push(`/equity/dividend_rounds/${row.type}/${row.id}`)}
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

function formatStatus(status: string) {
  return capitalize(status.replace(/_/gu, " "));
}

function getStatus(status: string) {
  switch (status) {
    case "Draft":
      return { Icon: Circle, color: "text-black/18" };
    case "Issued":
      return { Icon: Circle, color: "text-blue-600" };
    case "Paid":
      return { Icon: CheckCircle2, color: "text-green" };
    default:
      return { Icon: Circle, color: "text-black/18" };
  }
}
