"use client";
import { PencilIcon } from "@heroicons/react/16/solid";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import PaginationSection, { usePage } from "@/components/PaginationSection";
import Placeholder from "@/components/Placeholder";
import Table, { createColumnHelper, useTable } from "@/components/Table";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

const perPage = 50;
export default function TenderOffers() {
  const company = useCurrentCompany();
  const router = useRouter();
  const user = useCurrentUser();
  const [page] = usePage();
  const [data] = trpc.tenderOffers.list.useSuspenseQuery({ companyId: company.id, page, perPage });

  const columnHelper = createColumnHelper<(typeof data.tenderOffers)[number]>();
  const columns = [
    columnHelper.accessor("startsAt", {
      header: "Start date",
      cell: (info) => <Link href={`/equity/tender_offers/${info.row.original.id}`}>{formatDate(info.getValue())}</Link>,
    }),
    columnHelper.simple("endsAt", "End date", formatDate),
    columnHelper.simple("minimumValuation", "Minimum valuation", formatMoney),
  ];

  const table = useTable({ columns, data: data.tenderOffers });

  return (
    <EquityLayout
      headerActions={
        user.activeRole === "administrator" ? (
          <Button asChild>
            <Link href="/equity/tender_offers/new">
              <PencilIcon className="size-4" />
              New tender offer
            </Link>
          </Button>
        ) : null
      }
    >
      {data.tenderOffers.length ? (
        <>
          <Table table={table} onRowClicked={(row) => router.push(`/equity/tender_offers/${row.id}`)} />
          <PaginationSection total={data.total} perPage={perPage} />
        </>
      ) : (
        <Placeholder icon={CheckCircleIcon}>There are no tender offers yet.</Placeholder>
      )}
    </EquityLayout>
  );
}
