"use client";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import React from "react";
import Placeholder from "@/components/Placeholder";
import Table, { createColumnHelper, useTable } from "@/components/Table";
import { Progress } from "@/components/ui/progress";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import EquityLayout from "../Layout";

type OptionPool = RouterOutput["optionPools"]["list"][number];

const columnHelper = createColumnHelper<OptionPool>();
const columns = [
  columnHelper.simple("name", "Name", (value) => <strong>{value}</strong>),
  columnHelper.simple("authorizedShares", "Authorized shares", (value) => value.toLocaleString(), "numeric"),
  columnHelper.simple("issuedShares", "Issued shares", (value) => value.toLocaleString(), "numeric"),
  columnHelper.display({
    id: "progress",
    cell: (info) => (
      <Progress max={Number(info.row.original.authorizedShares)} value={Number(info.row.original.issuedShares)} />
    ),
  }),
  columnHelper.simple("availableShares", "Available shares", (value) => value.toLocaleString(), "numeric"),
];

export default function OptionPools() {
  const company = useCurrentCompany();
  const [data] = trpc.optionPools.list.useSuspenseQuery({ companyId: company.id });

  const table = useTable({ columns, data });

  return (
    <EquityLayout>
      {data.length > 0 ? (
        <Table table={table} />
      ) : (
        <Placeholder icon={CheckCircleIcon}>The company does not have any option pools.</Placeholder>
      )}
    </EquityLayout>
  );
}
