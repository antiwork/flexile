"use client";
import { Download } from "lucide-react";
import { useParams } from "next/navigation";
import React, { useMemo } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { export_company_liquidation_scenario_path } from "@/utils/routes";
import EquityLayout from "../Layout";

type Scenario = RouterOutput["liquidationScenarios"]["show"];

export default function ScenarioPage() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const { data, isLoading } = trpc.liquidationScenarios.show.useQuery({ companyId: company.id, scenarioId: id });

  const columnHelper = createColumnHelper<Scenario["payouts"][number]>();
  const columns = useMemo(
    () => [
      columnHelper.simple("investorName", "Investor"),
      columnHelper.simple("shareClass", "Share class"),
      columnHelper.simple("securityType", "Security"),
      columnHelper.simple(
        "numberOfShares",
        "Shares",
        (v) => (v ? Number(v).toLocaleString() : "—"),
        "numeric",
      ),
      columnHelper.simple(
        "liquidationPreferenceAmount",
        "Preference",
        (v) => (v ? formatMoneyFromCents(v) : "—"),
        "numeric",
      ),
      columnHelper.simple(
        "participationAmount",
        "Participation",
        (v) => (v ? formatMoneyFromCents(v) : "—"),
        "numeric",
      ),
      columnHelper.simple("payoutAmountCents", "Payout", formatMoneyFromCents, "numeric"),
    ],
    [],
  );

  const equityTable = useTable({ data: data?.payouts.filter(p => p.securityType === "equity") ?? [], columns });
  const convertibleTable = useTable({ data: data?.payouts.filter(p => p.securityType === "convertible") ?? [], columns });

  return (
    <EquityLayout
      headerActions={
        <Button variant="outline" size="small" asChild>
          <a href={export_company_liquidation_scenario_path(company.id, id)}>
            <Download className="size-4" />
            Download CSV
          </a>
        </Button>
      }
    >
      {isLoading || !data ? (
        <TableSkeleton columns={7} />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">{data.name}</h2>
            {data.description ? <p>{data.description}</p> : null}
            <div className="text-sm text-muted-foreground">
              Exit amount: {formatMoneyFromCents(data.exitAmountCents)} · Exit date: {formatDate(data.exitDate)}
            </div>
          </div>
          {data.payouts.length > 0 ? (
            <>
              {equityTable.getRowModel().rows.length > 0 && (
                <div className="overflow-x-auto">
                  <DataTable table={equityTable} caption="Equity" />
                </div>
              )}
              {convertibleTable.getRowModel().rows.length > 0 && (
                <div className="overflow-x-auto">
                  <DataTable table={convertibleTable} caption="Convertibles" />
                </div>
              )}
            </>
          ) : (
            <Placeholder>No payouts recorded</Placeholder>
          )}
        </div>
      )}
    </EquityLayout>
  );
}
