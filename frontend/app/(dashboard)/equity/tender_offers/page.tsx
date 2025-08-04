"use client";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { CircleCheck, DollarSign, Plus, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { getBuybackStatus } from "@/app/(dashboard)/equity/tender_offers";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import PlaceBidModal from "./[id]/PlaceBidModal";
import NewBuybackModal from "./NewBuybackModal";

type ActiveModal = "place-bid" | "new-buyback" | null;
type TenderOffer = RouterOutput["tenderOffers"]["list"][number];

export default function Buybacks() {
  const company = useCurrentCompany();
  const router = useRouter();
  const user = useCurrentUser();
  const { data = [], isLoading, refetch } = trpc.tenderOffers.list.useQuery({ companyId: company.id });

  const columnHelper = createColumnHelper<TenderOffer>();

  const [selectedBuyback, setSelectedBuyback] = useState<TenderOffer | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const { data: selectedBuybackData, isLoading: isLoadingSelectedBuyback } = trpc.tenderOffers.get.useQuery(
    { id: selectedBuyback?.id || "", companyId: company.id },
    { enabled: !!selectedBuyback?.id && activeModal === "place-bid" },
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => {
          const content = info.getValue();
          return (
            <Link href={`/equity/tender_offers/${info.row.original.id}`} className="after:absolute after:inset-0">
              {content || "—"}
            </Link>
          );
        },
      }),
      columnHelper.simple("endsAt", "End date", formatDate),
      columnHelper.accessor("minimumValuation", {
        header: "Starting valuation",
        cell: (info) => {
          const value = info.getValue();
          if (!value) return "—";
          return formatMoney(value);
        },
      }),
      columnHelper.accessor("impliedValuation", {
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
        ? columnHelper.accessor("investorCount", {
            header: "Investors",
            cell: (info) => info.getValue(),
          })
        : columnHelper.accessor("bidCount", {
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
        cell: (info) => {
          const loading = !!isLoadingSelectedBuyback && selectedBuyback?.id === info.row.original.id;
          return (
            <>
              {getBuybackStatus(info.row.original) === "Open" ? (
                <Button
                  size="small"
                  variant="outline"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBuyback(info.row.original);
                    setActiveModal("place-bid");
                  }}
                >
                  {loading ? "Loading..." : "Place bid"}
                </Button>
              ) : null}
              {user.roles.administrator && getBuybackStatus(info.row.original) === "Reviewing" ? (
                <Button
                  size="small"
                  className="fill-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/equity/tender_offers/${info.row.original.id}`);
                  }}
                >
                  Review
                </Button>
              ) : null}
            </>
          );
        },
      }),
    ],
    [company.fullyDilutedShares, user.roles.administrator, isLoadingSelectedBuyback, selectedBuyback?.id],
  );

  const table = useTable({
    columns,
    data,
    getSortedRowModel: getSortedRowModel(),
    ...(user.roles.administrator && { getFilteredRowModel: getFilteredRowModel() }),
  });

  return (
    <>
      <DashboardHeader
        title="Buybacks"
        headerActions={
          user.roles.administrator && !data.length ? (
            <Button size="small" variant="outline" onClick={() => setActiveModal("new-buyback")}>
              <Plus className="size-4" />
              New buyback
            </Button>
          ) : null
        }
      />
      {isLoading ? (
        <TableSkeleton columns={columns.length} />
      ) : data.length ? (
        <DataTable
          searchColumn={user.roles.administrator ? "name" : undefined}
          table={table}
          onRowClicked={(row) => router.push(`/equity/tender_offers/${row.id}`)}
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
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>There are no buybacks yet.</Placeholder>
        </div>
      )}

      {activeModal === "place-bid" && selectedBuybackData ? (
        <PlaceBidModal
          onClose={() => {
            setActiveModal(null);
            setSelectedBuyback(null);
            void refetch();
          }}
          data={selectedBuybackData}
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
    </>
  );
}
