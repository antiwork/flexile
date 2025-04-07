"use client";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Placeholder from "@/components/Placeholder";
import Progress from "@/components/Progress";
import Table, { createColumnHelper, useTable } from "@/components/Table";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import EquityLayout from "../Layout";
import React from "react";

type OptionPool = RouterOutput["optionPools"]["list"][number];

const columnHelper = createColumnHelper<OptionPool>();
const columns = [
  columnHelper.simple("name", "Name", (value) => <strong>{value}</strong>),
  columnHelper.simple("authorizedShares", "Authorized shares", (value) => value.toLocaleString(), "numeric"),
  columnHelper.simple("issuedShares", "Issued shares", (value) => value.toLocaleString(), "numeric"),
  columnHelper.display({
    id: "progress",
    cell: (info) => (
      <Progress max={info.row.original.authorizedShares.toString()} value={info.row.original.issuedShares.toString()} />
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
