"use client";
import { useQuery } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { CircleCheck, DollarSign, Plus, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { z } from "zod";
import { type Buyback, buybackSchema, getBuybackStatus } from "@/app/equity/buybacks";
import NewBuybackModal from "@/app/equity/buybacks/NewBuybackModal";
import PlaceBidModal from "@/app/equity/buybacks/PlaceBidModal";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { formatMoney } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_tender_offers_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

type ActiveModal = "place-bid" | "new-buyback" | null;

export default function Buybacks() {
  const company = useCurrentCompany();
  const router = useRouter();
  const user = useCurrentUser();

  const {
    data = { buybacks: [] },
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["buybacks", company.id],
    queryFn: async () => {
      const response = await request({
        accept: "json",
        method: "GET",
        url: company_tender_offers_path(company.id),
        assertOk: true,
      });
      return z
        .object({
          buybacks: z.array(buybackSchema),
        })
        .parse(await response.json());
    },
  });

  const [selectedBuyback, setSelectedBuyback] = useState<Buyback | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const columnHelper = createColumnHelper<Buyback>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => {
          const content = info.getValue();
          return (
            <Link href={`/equity/buybacks/${info.row.original.id}`} className="after:absolute after:inset-0">
              {content}
            </Link>
          );
        },
      }),
      columnHelper.simple("ends_at", "End date", formatDate),
      columnHelper.simple("minimum_valuation", "Starting valuation", formatMoney),
      columnHelper.accessor("implied_valuation", {
        header: "Implied valuation",
        cell: (info) => {
          const value = info.getValue();
          if (!value) return "—";
          return formatMoney(value);
        },
      }),
      columnHelper.accessor("participation", {
        header: "Participation",
        cell: (info) => {
          const participation = info.getValue();
          if (!participation) return "—";
          return formatMoney(participation);
        },
      }),
      user.roles.administrator
        ? columnHelper.accessor("investor_count", {
            header: "Investors",
            cell: (info) => info.getValue(),
          })
        : columnHelper.accessor("bid_count", {
            header: "Your bids",
            cell: (info) => info.getValue(),
          }),
      columnHelper.accessor(
        (row) => {
          const status = getBuybackStatus(row);
          if (!user.roles.administrator && status === "Closed") return "Reviewing";
          return status;
        },
        {
          id: "status",
          header: "Status",
          meta: { filterOptions: ["Open", "Closed", "Reviewing", "Settled"] },
          cell: (info) =>
            info.getValue() === "Open" ? (
              <div className="inline-flex items-center gap-2">
                <span className="bg-green h-4 w-4 rounded-full text-white" />
                {info.getValue()}
              </div>
            ) : info.getValue() === "Closed" ? (
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-white">
                  <XIcon className="h-3 w-3" />
                </span>
                {info.getValue()}
              </div>
            ) : info.getValue() === "Reviewing" ? (
              <div className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-gray-300 text-white" />
                {info.getValue()}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                  <DollarSign className="h-3 w-3" />
                </span>
                {info.getValue()}
              </div>
            ),
        },
      ),

      columnHelper.display({
        id: "actions",
        cell: (info) => (
          <>
            {getBuybackStatus(info.row.original) === "Open" ? (
              <Button
                size="small"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBuyback(info.row.original);
                  setActiveModal("place-bid");
                }}
              >
                Place bid
              </Button>
            ) : null}
            {user.roles.administrator && getBuybackStatus(info.row.original) === "Reviewing" ? (
              <Button
                size="small"
                className="fill-black"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/equity/buybacks/${info.row.original.id}`);
                }}
              >
                Review
              </Button>
            ) : null}
          </>
        ),
      }),
    ],
    [company.fullyDilutedShares, user.roles.administrator],
  );

  const table = useTable({
    columns,
    data: data.buybacks,
    getSortedRowModel: getSortedRowModel(),
    ...(user.roles.administrator && { getFilteredRowModel: getFilteredRowModel() }),
  });

  return (
    <EquityLayout
      headerActions={
        user.roles.administrator && !data.buybacks.length ? (
          <Button size="small" variant="outline" onClick={() => setActiveModal("new-buyback")}>
            <Plus className="size-4" />
            New buyback
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <TableSkeleton columns={columns.length} />
      ) : data.buybacks.length ? (
        <DataTable
          searchColumn={user.roles.administrator ? "name" : undefined}
          table={table}
          onRowClicked={(row) => router.push(`/equity/buybacks/${row.id}`)}
          actions={
            user.roles.administrator ? (
              <Button size="small" variant="outline" onClick={() => setActiveModal("new-buyback")}>
                <Plus className="size-4" />
                New buyback
              </Button>
            ) : null
          }
        />
      ) : (
        <Placeholder icon={CircleCheck}>There are no buybacks yet.</Placeholder>
      )}

      {activeModal === "place-bid" ? (
        <PlaceBidModal
          onClose={() => {
            setActiveModal(null);
            setSelectedBuyback(null);
            void refetch();
          }}
          buyback={selectedBuyback}
        />
      ) : null}

      {activeModal === "new-buyback" ? (
        <NewBuybackModal
          onClose={() => {
            setActiveModal(null);
            void refetch();
          }}
        />
      ) : null}
    </EquityLayout>
  );
}
