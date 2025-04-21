"use client";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

type DividendRound = RouterOutput["dividendRounds"]["list"][number];
const columnHelper = createColumnHelper<DividendRound>();
const columns = [
  columnHelper.accessor("issuedAt", {
    header: "Issue date",
    cell: (info) => (
      <Link href={`/equity/dividend_rounds/${info.row.original.id}`} className="no-underline">
        {formatDate(info.getValue())}
      </Link>
    ),
  }),
  columnHelper.simple("totalAmountInCents", "Dividend amount", formatMoneyFromCents, "numeric"),
  columnHelper.simple("numberOfShareholders", "Shareholders", (value) => value.toLocaleString(), "numeric"),
];

export default function DividendRounds() {
  const company = useCurrentCompany();
  const router = useRouter();
  const [dividendRounds] = trpc.dividendRounds.list.useSuspenseQuery({ companyId: company.id });

  const table = useTable({ columns, data: dividendRounds });

  return (
    <EquityLayout>
      {dividendRounds.length > 0 ? (
        <DataTable table={table} onRowClicked={(row) => router.push(`/equity/dividend_rounds/${row.id}`)} />
      ) : (
        <Placeholder icon={CheckCircleIcon}>You have not issued any dividends yet.</Placeholder>
      )}
    </EquityLayout>
  );
}
