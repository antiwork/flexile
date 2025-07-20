"use client";
import { CircleCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

export default function Buybacks() {
  const company = useCurrentCompany();
  const router = useRouter();
  const user = useCurrentUser();
  const { data = [], isLoading } = trpc.tenderOffers.list.useQuery({ companyId: company.id });

  const columnHelper = createColumnHelper<RouterOutput["tenderOffers"]["list"][number]>();
  const columns = [
    columnHelper.accessor("startsAt", {
      header: "Start date",
      cell: (info) => <Link href={`/equity/tender_offers/${info.row.original.id}`}>{formatDate(info.getValue())}</Link>,
    }),
    columnHelper.simple("endsAt", "End date", formatDate),
    columnHelper.simple("minimumValuation", "Starting valuation", formatMoney),
  ];

  const table = useTable({ columns, data });

  return (
    <EquityLayout
      headerActions={
        user.roles.administrator ? (
          <Button asChild size="small" variant="outline">
            <Link href="/equity/tender_offers/new">
              <Plus className="size-4" />
              New buyback
            </Link>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <TableSkeleton columns={3} />
      ) : data.length ? (
        <DataTable table={table} onRowClicked={(row) => router.push(`/equity/tender_offers/${row.id}`)} />
      ) : (
        <Placeholder icon={CircleCheck}>There are no buybacks yet.</Placeholder>
      )}
    </EquityLayout>
  );
}
