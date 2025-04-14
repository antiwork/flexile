"use client";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import Placeholder from "@/components/Placeholder";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

type DividendRound = RouterOutput["dividendRounds"]["list"]["dividendRounds"][number];
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

const perPage = 50;
export default function DividendRounds() {
  const company = useCurrentCompany();
  const router = useRouter();
  const [page] = usePage();
  const [data] = trpc.dividendRounds.list.useSuspenseQuery({ companyId: company.id, perPage, page });

  const table = useTable({ columns, data: data.dividendRounds });

  return (
    <EquityLayout>
      {data.dividendRounds.length > 0 ? (
        <>
          <DataTable table={table} onRowClicked={(row) => router.push(`/equity/dividend_rounds/${row.id}`)} />
          <PaginationSection total={data.total} perPage={perPage} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>You have not issued any dividends yet.</Placeholder>
      )}
    </EquityLayout>
  );
}
