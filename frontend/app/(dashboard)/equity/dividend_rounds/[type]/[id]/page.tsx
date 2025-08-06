"use client";

import { useQuery } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { Circle, Info } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { z } from "zod";
import DividendStatusIndicator from "@/app/(dashboard)/equity/DividendStatusIndicator";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { per_investor_company_dividend_computation_path } from "@/utils/routes";

type TransformedData = {
  investor: { name: string; id: string | null };
  status: { value: string; Component: React.JSX.Element };
  totalAmountUsd: number;
  numberOfShares: number | null;
  flexileFee: number;
};

const responseSchema = z.array(
  z.object({
    investor_name: z.string(),
    company_investor_id: z.number().nullable(),
    investor_external_id: z.string().nullable(),
    total_amount: z.string(),
    number_of_shares: z.number(),
  }),
);

export default function DividendRound() {
  const { id, type } = useParams<{ id: string; type: "draft" | "round" }>();
  const isDraft = type === "draft";

  const company = useCurrentCompany();
  const router = useRouter();
  const isDividendComputationEnabled = company.flags.includes("dividend_computation");

  if (isDraft && !isDividendComputationEnabled) {
    router.replace("/equity/dividend_rounds");
    return null;
  }

  const { data: dividendOutputs = [], isLoading: isLoadingDividendOutputs } = useQuery({
    queryKey: ["dividend-computation", id],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        accept: "json",
        url: per_investor_company_dividend_computation_path(company.id, BigInt(id)),
        assertOk: true,
      });
      return responseSchema.parse(await response.json());
    },
    enabled: isDraft && isDividendComputationEnabled,
    select: (outputs) =>
      outputs.map((output) => ({
        investor: {
          name: output.investor_name || "Unknown",
          id: output.investor_external_id ?? null,
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
        totalAmountUsd: Number(output.total_amount),
        numberOfShares: output.number_of_shares,
        flexileFee: calculateFlexileFees(Number(output.total_amount)),
      })),
  });

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
          numberOfShares:
            dividend.numberOfShares && dividend.numberOfShares > 0 ? Number(dividend.numberOfShares) : null,
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
    columnHelper.accessor("numberOfShares", {
      header: "Number of shares",
      // SAFE investors don't have number of shares
      cell: (info) => info.getValue()?.toLocaleString() ?? "—",
      meta: { numeric: true },
      footer: sums.numberOfSharesSum > 0 ? sums.numberOfSharesSum.toLocaleString() : "—",
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
  const isLoading = (isDraft && isDividendComputationEnabled ? isLoadingDividendOutputs : false) || isLoadingDividends;
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
  const numberOfSharesSum = data.reduce((sum, item) => sum + (item.numberOfShares ?? 0), 0);
  const flexileFeeSum = data.reduce((sum, item) => sum + item.flexileFee, 0);

  return {
    totalAmountUsdSum,
    numberOfSharesSum,
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
