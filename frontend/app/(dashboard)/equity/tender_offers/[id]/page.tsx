"use client";
import { utc } from "@date-fns/utc";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { isFuture, isPast } from "date-fns";
import { InboxIcon, LucideCircleDollarSign, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import PlaceTenderOfferBidModal from "./PlaceBidModal";

type TenderOffer = RouterOutput["tenderOffers"]["get"];
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];
type ActiveModal = "place-bid" | "cancel-bid" | null;

type CancelBidModalProps = {
  onClose: () => void;
  bid: Bid;
  data: TenderOffer;
};

export default function BuybackView() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [data] = trpc.tenderOffers.get.useSuspenseQuery({ companyId: company.id, id });
  const isOpen = isPast(utc(data.startsAt)) && isFuture(utc(data.endsAt));
  const investorId = user.roles.investor?.id;
  const {
    data: bids = [],
    isLoading,
    refetch: refetchBids,
  } = trpc.tenderOffers.bids.list.useQuery({
    companyId: company.id,
    tenderOfferId: id,
    investorId: user.roles.administrator ? undefined : investorId,
  });

  const columnHelper = createColumnHelper<Bid>();

  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const handleBidAction = (bid: Bid | null, action?: "cancel-bid") => {
    setSelectedBid(bid);
    setActiveModal(action || null);
  };

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("companyInvestor.user.email", {
          header: "Investor",
          cell: (info) => (info.row.original.companyInvestor.user.id === user.id ? "You!" : info.getValue()),
        }),
        columnHelper.simple("shareClass", "Share class"),
        columnHelper.simple("numberOfShares", "Number of shares", (value) => value.toLocaleString()),
        columnHelper.simple("sharePriceCents", "Bid price", formatMoneyFromCents),
        isOpen
          ? columnHelper.display({
              id: "actions",
              cell: (info) =>
                info.row.original.companyInvestor.user.id === user.id ? (
                  <Button variant="outline" onClick={() => handleBidAction(info.row.original, "cancel-bid")}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null,
            })
          : null,
      ].filter((column) => !!column),
    [],
  );

  const bidsTable = useTable({ data: bids, columns });

  return (
    <>
      <DashboardHeader
        title={`Buyback details ("Sell Elections")`}
        headerActions={
          isOpen ? (
            <Button size="small" onClick={() => setActiveModal("place-bid")}>
              Place bid
            </Button>
          ) : null
        }
      />

      {user.roles.investor?.investedInAngelListRuv ? (
        <Alert className="mx-4" variant="destructive">
          <ExclamationTriangleIcon />
          <AlertDescription>
            Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV itself.
            Please contact them for more information about this process.
          </AlertDescription>
        </Alert>
      ) : null}
      {isLoading ? (
        <TableSkeleton columns={columns.length} />
      ) : bids.length > 0 ? (
        <DataTable table={bidsTable} />
      ) : user.roles.administrator ? (
        <div className="mx-4">
          <Placeholder icon={InboxIcon}>
            Investors can place bids now. Activity will appear here as it happens.
          </Placeholder>
        </div>
      ) : (
        <div className="mx-4">
          <Placeholder icon={LucideCircleDollarSign}>Place your first bid to participate in the data.</Placeholder>
        </div>
      )}
      {activeModal === "place-bid" ? (
        <PlaceTenderOfferBidModal
          onClose={() => {
            setActiveModal(null);
            void refetchBids();
          }}
          tenderOfferId={id}
          data={data}
        />
      ) : null}
      {activeModal === "cancel-bid" && selectedBid ? (
        <CancelTenderOfferBidModal
          onClose={() => {
            handleBidAction(null);
            void refetchBids();
          }}
          data={data}
          bid={selectedBid}
        />
      ) : null}
    </>
  );
}

const CancelTenderOfferBidModal = ({ onClose, bid }: CancelBidModalProps) => {
  const company = useCurrentCompany();

  const destroyMutation = trpc.tenderOffers.bids.destroy.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel bid?</DialogTitle>
        </DialogHeader>
        <p>Are you sure you want to cancel this bid?</p>
        <p>
          Share class: {bid.shareClass}
          <br />
          Number of shares: {bid.numberOfShares.toLocaleString()}
          <br />
          Bid price: {formatMoneyFromCents(bid.sharePriceCents)}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            No, keep bid
          </Button>
          <MutationButton
            mutation={destroyMutation}
            param={{ id: bid.id, companyId: company.id }}
            loadingText="Canceling..."
          >
            Yes, cancel bid
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
