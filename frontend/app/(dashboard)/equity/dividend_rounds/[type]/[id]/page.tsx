"use client";

import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { Circle, Info } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import DividendStatusIndicator from "@/app/(dashboard)/equity/DividendStatusIndicator";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";

type TransformedData = {
  investor: { name: string; id: string | undefined };
  status: { value: string; Component: React.JSX.Element };
  totalAmountUsd: number;
  flexileFee: number;
};

export default function DividendRound() {
  const { id, type } = useParams<{ id: string; type: "draft" | "round" }>();
  const isDraft = type === "draft";

  const company = useCurrentCompany();
  const router = useRouter();

  const { data: dividendOutputs = [], isLoading: isLoadingDividendOutputs } =
    trpc.dividendComputations.getOutputs.useQuery(
      {
        id: BigInt(id),
        companyId: company.id,
      },
      {
        enabled: isDraft,
        select: (outputs) => {
          // Aggregate outputs by investor
          const investorMap = new Map<string, TransformedData>();

          outputs.forEach((output) => {
            const investorKey = output.investorName || `investor_${output.companyInvestorId}`;

            const existing = investorMap.get(investorKey) || {
              investor: {
                name: output.investorName || output.companyInvestor?.user?.legalName || "Unknown",
                id: output.companyInvestor?.user?.externalId,
              },
              status: {
                value: "DRAFT",
                Component: (
                  <div className="flex items-center gap-2">
                    <Circle className="size-4 text-black/18" />
                    <span>Draft</span>
                  </div>
                ),
              },
              totalAmountUsd: 0,
              flexileFee: 0,
            };

            existing.totalAmountUsd += Number(output.totalAmountInUsd);
            existing.flexileFee = calculateFlexileFees(existing.totalAmountUsd);

            investorMap.set(investorKey, existing);
          });

          return Array.from(investorMap.values());
        },
      },
    );

  const { data: dividends = [], isLoading: isLoadingDividends } = trpc.dividends.list.useQuery(
    {
      companyId: company.id,
      dividendRoundId: Number(id),
    },
    {
      enabled: !isDraft,
      select: (dividends) =>
        dividends.map((dividend) => ({
          investor: {
            name: dividend.investor?.user?.name || "Unknown",
            id: dividend.investor?.user?.id,
          },
          status: { value: dividend.status, Component: <DividendStatusIndicator dividend={dividend} /> },
          totalAmountUsd: Number(dividend.totalAmountInCents) / 100,
          flexileFee: calculateFlexileFees(Number(dividend.totalAmountInCents) / 100),
        })),
    },
  );

  const sums = calculateSums(isDraft ? dividendOutputs : dividends);

  const columnHelper = createColumnHelper<TransformedData>();
  const columns = [
    columnHelper.accessor("investor.name", {
      id: "investor",
      header: "Investor",
      cell: (info) => <div className="font-light">{info.getValue()}</div>,
      footer: "Total",
    }),
    columnHelper.accessor("totalAmountUsd", {
      header: "Return amount",
      cell: (info) => formatMoney(info.getValue()),
      meta: { numeric: true },
      footer: formatMoney(sums.totalAmountUsdSum),
    }),
    columnHelper.accessor("flexileFee", {
      header: "Fees",
      cell: (info) => formatMoney(info.getValue()),
      meta: { numeric: true },
      footer: formatMoney(sums.flexileFeeSum),
    }),
    columnHelper.accessor("status.value", {
      header: "Status",
      cell: (info) => info.row.original.status.Component,
      ...(!isDraft && {
        meta: {
          filterOptions: Array.from(new Set(dividends.map((dividend) => dividend.status.value))),
        },
      }),
    }),
  ];

  const data: TransformedData[] = isDraft ? dividendOutputs : dividends;
  const isLoading = isDraft ? isLoadingDividendOutputs : isLoadingDividends;
  const table = useTable({
    data,
    columns,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [
        {
          id: "totalAmountUsd",
          desc: true,
        },
      ],
    },
  });

  const onRowClicked = (row: TransformedData) => {
    // No ID for SAFEs
    if (row.investor.id) {
      router.push(`/people/${row.investor.id}?tab=dividends`);
    }
  };

  return (
    <>
      <DashboardHeader title="Dividend" />
      {isDraft ? <DistributionDraftNotice /> : null}
      {isLoading ? (
        <TableSkeleton columns={4} />
      ) : (
        <DataTable table={table} onRowClicked={onRowClicked} searchColumn="investor" />
      )}
    </>
  );
}

function calculateSums(data: TransformedData[]) {
  const totalAmountUsdSum = data.reduce((sum, item) => sum + item.totalAmountUsd, 0);
  const flexileFeeSum = data.reduce((sum, item) => sum + item.flexileFee, 0);

  return {
    totalAmountUsdSum,
    flexileFeeSum,
  };
}

function calculateFlexileFees(totalAmountInUsd: number): number {
  const FLEXILE_FEE_RATE = 0.029; // 2.9%
  const FLEXILE_FLAT_FEE = 0.3; // $0.30
  const FLEXILE_MAX_FEE = 30; // $30 cap

  const calculatedFee = totalAmountInUsd * FLEXILE_FEE_RATE + FLEXILE_FLAT_FEE;
  return Math.min(FLEXILE_MAX_FEE, calculatedFee);
}

const DistributionDraftNotice = () => (
  <div className="mb-4 flex items-center gap-2 bg-blue-50 px-4 py-4">
    <Info className="size-3.5 flex-shrink-0 text-blue-600" />
    <p className="text-sm">
      <strong>Dividend distribution is still a draft.</strong> Shareholders won’t be notified or paid until you click{" "}
      <strong>Finalize distribution.</strong>
    </p>
  </div>
);
