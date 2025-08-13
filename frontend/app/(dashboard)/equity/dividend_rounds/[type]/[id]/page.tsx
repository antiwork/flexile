"use client";

import { useQuery } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { Circle, Info } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { z } from "zod";
import DividendStatusIndicator from "@/app/(dashboard)/equity/DividendStatusIndicator";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import TableSkeleton from "@/components/TableSkeleton";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_dividend_computation_path } from "@/utils/routes";

export default function DividendRoundPage() {
  const { id, type } = useParams<{ id: string; type: "draft" | "round" }>();
  const isDraft = type === "draft";

  return (
    <>
      <DashboardHeader title="Dividend" />
      {isDraft ? <DividendComputation id={id} /> : <DividendRound id={id} />}
    </>
  );
}

type Dividend = RouterOutput["dividends"]["list"][number];
const DividendRound = ({ id }: { id: string }) => {
  const company = useCurrentCompany();
  const router = useRouter();

  const { data: dividends = [], isLoading } = trpc.dividends.list.useQuery({
    companyId: company.id,
    dividendRoundId: Number(id),
  });

  const columnHelper = createColumnHelper<Dividend>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("investor.user.name", {
        id: "investor",
        header: "Investor",
        cell: (info) => <div className="font-light">{info.getValue() || "Unknown"}</div>,
        footer: "Total",
      }),
      columnHelper.accessor("totalAmountInCents", {
        header: "Return amount",
        cell: (info) => formatMoney(Number(info.getValue()) / 100),
        meta: { numeric: true },
        footer: formatMoney(dividends.reduce((sum, dividend) => sum + Number(dividend.totalAmountInCents) / 100, 0)),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <DividendStatusIndicator dividend={info.row.original} />,
        meta: {
          filterOptions: Array.from(new Set(dividends.map((dividend) => dividend.status))),
        },
      }),
    ],
    [dividends],
  );

  const table = useTable({
    data: dividends,
    columns,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [
        {
          id: "totalAmountInCents",
          desc: true,
        },
      ],
    },
  });

  const onRowClicked = (row: Dividend) => {
    if (row.investor?.user?.id) {
      router.push(`/people/${row.investor.user.id}?tab=shares`);
    }
  };

  if (isLoading) {
    return <TableSkeleton columns={5} />;
  }

  return <DataTable table={table} onRowClicked={onRowClicked} searchColumn="investor" />;
};

const dividendComputationSchema = z.object({
  id: z.number(),
  total_amount_in_usd: z.string(),
  dividends_issuance_date: z.string(),
  return_of_capital: z.boolean(),
  number_of_shareholders: z.number(),
  computation_outputs: z.array(
    z.object({
      investor_name: z.string(),
      company_investor_id: z.number().nullable(),
      investor_external_id: z.string().nullable(),
      total_amount: z.string(),
      number_of_shares: z.number(),
    }),
  ),
});

type DividendComputation = z.infer<typeof dividendComputationSchema>;
type DividendComputationOutput = DividendComputation["computation_outputs"][number];
const DividendComputation = ({ id }: { id: string }) => {
  const company = useCurrentCompany();
  const router = useRouter();

  const { data: dividendComputation, isLoading } = useQuery({
    queryKey: ["dividend-computation", id],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        accept: "json",
        url: company_dividend_computation_path(company.id, BigInt(id)),
        assertOk: true,
      });
      return dividendComputationSchema.parse(await response.json());
    },
  });

  const computationOutputs = dividendComputation?.computation_outputs ?? [];
  const columnHelper = createColumnHelper<DividendComputationOutput>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("investor_name", {
        id: "investor",
        header: "Investor",
        cell: (info) => <div className="font-light">{info.getValue() || "Unknown"}</div>,
        footer: "Total",
      }),
      columnHelper.accessor("total_amount", {
        header: "Return amount",
        cell: (info) => formatMoney(Number(info.getValue())),
        meta: { numeric: true },
        footer: formatMoney(computationOutputs.reduce((sum, output) => sum + Number(output.total_amount), 0)),
      }),
      columnHelper.accessor("investor_external_id", {
        id: "status",
        header: "Status",
        cell: () => (
          <div className="flex items-center gap-2">
            <Circle className="size-4 text-black/18" />
            <span>Draft</span>
          </div>
        ),
      }),
    ],
    [computationOutputs],
  );

  const table = useTable({
    data: computationOutputs,
    columns,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [
        {
          id: "total_amount",
          desc: true,
        },
      ],
    },
  });

  const onRowClicked = (row: DividendComputationOutput) => {
    if (row.investor_external_id) {
      router.push(`/people/${row.investor_external_id}?tab=shares`);
    }
  };

  if (isLoading) {
    return <TableSkeleton columns={5} />;
  }

  return (
    <>
      <DistributionDraftNotice />
      <DataTable table={table} onRowClicked={onRowClicked} searchColumn="investor" />
    </>
  );
};

const DistributionDraftNotice = () => (
  <div className="mb-4 flex items-center gap-2 bg-blue-50 px-4 py-4">
    <Info className="size-3.5 flex-shrink-0 text-blue-600" />
    <p className="text-sm">
      <strong>Dividend distribution is still a draft.</strong> Shareholders won't be notified or paid until you click{" "}
      <strong>Finalize distribution.</strong>
    </p>
  </div>
);
