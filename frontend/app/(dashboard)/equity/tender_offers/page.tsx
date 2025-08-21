"use client";
import { CircleCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { useIsMobile } from "@/utils/use-mobile";
import PlaceTenderOfferBidModal from "./[id]/PlaceBidModal";

type ActiveModal = "place-bid" | null;

export default function Buybacks() {
  const isMobile = useIsMobile();
  const company = useCurrentCompany();
  const router = useRouter();
  const user = useCurrentUser();

  const [selectedTenderOffer, setSelectedTenderOffer] = useState<RouterOutput["tenderOffers"]["list"][number] | null>(
    null,
  );
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const { data = [], isLoading, refetch } = trpc.tenderOffers.list.useQuery({ companyId: company.id });
  const { data: selectedTenderOfferData, isLoading: isLoadingSelectedTenderOffer } = trpc.tenderOffers.get.useQuery(
    { id: selectedTenderOffer?.id || "", companyId: company.id },
    { enabled: !!selectedTenderOffer?.id && activeModal === "place-bid" },
  );

  const columnHelper = createColumnHelper<RouterOutput["tenderOffers"]["list"][number]>();
  const columns = [
    columnHelper.accessor("startsAt", {
      header: "Start date",
      cell: (info) => <Link href={`/equity/tender_offers/${info.row.original.id}`}>{formatDate(info.getValue())}</Link>,
    }),
    columnHelper.simple("endsAt", "End date", formatDate),
    columnHelper.simple("minimumValuation", "Starting valuation", formatMoney),
    columnHelper.display({
      id: "actions",
      cell: (info) => {
        const loading = !!isLoadingSelectedTenderOffer && selectedTenderOffer?.id === info.row.original.id;
        return (
          <Button
            size="small"
            variant="outline"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTenderOffer(info.row.original);
              setActiveModal("place-bid");
            }}
          >
            {loading ? "Loading..." : "Place bid"}
          </Button>
        );
      },
    }),
  ];

  const table = useTable({ columns, data });

  return (
    <>
      <DashboardHeader
        title="Buybacks"
        headerActions={
          user.roles.administrator ? (
            isMobile ? (
              <Button asChild variant="floating-action">
                <Link href="/equity/tender_offers/new">
                  <Plus />
                </Link>
              </Button>
            ) : (
              <Button asChild size="small" variant="outline">
                <Link href="/equity/tender_offers/new">
                  <Plus className="size-4" />
                  New buyback
                </Link>
              </Button>
            )
          ) : null
        }
      />

      {isLoading ? (
        <TableSkeleton columns={3} />
      ) : data.length ? (
        <DataTable table={table} onRowClicked={(row) => router.push(`/equity/tender_offers/${row.id}`)} />
      ) : (
        <div className="mx-4">
          <Placeholder icon={CircleCheck}>There are no buybacks yet.</Placeholder>
        </div>
      )}

      {activeModal === "place-bid" && selectedTenderOfferData ? (
        <PlaceTenderOfferBidModal
          onClose={() => {
            setActiveModal(null);
            setSelectedTenderOffer(null);
            void refetch();
          }}
          tenderOfferId={assertDefined(selectedTenderOffer?.id)}
          data={selectedTenderOfferData}
        />
      ) : null}
    </>
  );
}
