"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { isFuture } from "date-fns";
import { utc } from "@date-fns/utc";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton from "@/components/MutationButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { download } from "@/utils";

import Link from "next/link";
import PlaceBidModal from "@/app/equity/tender_offers/PlaceBidModal";
import FinalizeBuybackModal from "@/app/equity/tender_offers/FinalizeBuybackModal";
import ReviewInvestorsModal from "@/app/equity/tender_offers/ReviewInvestorsModal";
import ConfirmPaymentModal from "@/app/equity/tender_offers/ConfirmPaymentModal";
import Placeholder from "@/components/Placeholder";
import { Download, InboxIcon, InfoIcon, LucideCircleDollarSign, Trash2 } from "lucide-react";
import EquityLayout from "../../Layout";
import Status from "@/components/Status";
import { getFilteredRowModel, getSortedRowModel, type Table } from "@tanstack/react-table";
import { useMutation } from "@tanstack/react-query";

type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];
type TenderOffer = RouterOutput["tenderOffers"]["get"];

type BuybackActionsProps = {
  data: TenderOffer;
  user: ReturnType<typeof useCurrentUser>;
  bids: Bid[];
  isOpen: boolean;
  onSetActiveModal: (modal: "place" | "summary" | "review" | "confirm" | null) => void;
  table?: Table<Bid>;
};

const BuybackActions = ({ data, user, bids, isOpen, onSetActiveModal, table }: BuybackActionsProps) => {
  const handleDownloadCSV = () => {
    if (!table) return;

    const headers = table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== "actions")
      .map((col) => (typeof col.columnDef.header === "string" ? col.columnDef.header : col.id));

    const rows = table.getFilteredRowModel().rows.map((row) =>
      table
        .getVisibleLeafColumns()
        .filter((col) => col.id !== "actions")
        .map((col) => {
          const cell = row.getVisibleCells().find((cell) => cell.column.id === col.id);
          const cellValue = cell?.renderValue() ?? cell?.getValue();
          return typeof cellValue === "string" ? cellValue : "";
        }),
    );

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    download("text/csv", "Bids.csv", csvContent);
  };

  return (
    <>
      {data.attachment ? (
        <Button asChild size="small" variant="outline">
          <Link href={`/download/${data.attachment.key}/${data.attachment.filename}`}>
            <Download className="size-4" />
            Download documents
          </Link>
        </Button>
      ) : null}
      {user.roles.administrator && bids.length ? (
        <Button variant="outline" size="small" onClick={handleDownloadCSV}>
          <Download className="size-4" />
          Download CSV
        </Button>
      ) : null}
      {user.roles.administrator && !isOpen && bids.length ? (
        <Button size="small" onClick={() => onSetActiveModal("summary")}>
          Finalize buyback
        </Button>
      ) : null}
      {isOpen ? (
        <Button size="small" onClick={() => onSetActiveModal("place")}>
          Place bid
        </Button>
      ) : null}
    </>
  );
};

export default function BuybackView() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [data] = trpc.tenderOffers.get.useSuspenseQuery({ companyId: company.id, id });
  const isOpen = !data.acceptedPriceCents && isFuture(utc(data.endsAt));
  const investorId = user.roles.investor?.id;
  const [bids, { refetch: refetchBids }] = trpc.tenderOffers.bids.list.useSuspenseQuery({
    companyId: company.id,
    tenderOfferId: id,
    investorId: user.roles.administrator ? undefined : investorId,
  });

  const [cancelingBid, setCancelingBid] = useState<Bid | null>(null);
  const [activeModal, setActiveModal] = useState<"place" | "summary" | "review" | "confirm" | null>(null);

  const destroyMutation = trpc.tenderOffers.bids.destroy.useMutation({
    onSuccess: async () => {
      setCancelingBid(null);
      await refetchBids();
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      setActiveModal(null);
    },
  });

  const columnHelper = createColumnHelper<Bid>();
  const columns = useMemo(
    () =>
      [
        user.roles.administrator
          ? columnHelper.accessor("companyInvestor.user.name", {
              id: "investor",
              header: "Investor",
              cell: (info) => info.getValue(),
            })
          : null,
        columnHelper.simple("shareClass", "Share class"),
        user.roles.administrator || data.acceptedPriceCents
          ? columnHelper.display({
              id: "acceptedShares",
              header: "Accepted",
              cell: (info) => Number(info.row.original.acceptedShares || 0).toLocaleString(),
            })
          : null,
        columnHelper.simple("numberOfShares", "Shares", (value) => value.toLocaleString()),
        user.roles.administrator || data.acceptedPriceCents
          ? columnHelper.display({
              id: "clearingPrice",
              header: "Clearing Price",
              cell: (info) =>
                info.row.original.acceptedShares && data.acceptedPriceCents
                  ? formatMoneyFromCents(data.acceptedPriceCents)
                  : "-",
            })
          : null,
        columnHelper.simple("sharePriceCents", "Bid price", formatMoneyFromCents),
        columnHelper.display({
          id: "total",
          header: "Total",
          cell: (info) =>
            formatMoneyFromCents(Number(info.row.original.numberOfShares) * info.row.original.sharePriceCents), // TODO confirm this calculation
        }),
        !user.roles.administrator || data.acceptedPriceCents
          ? columnHelper.accessor(
              (row) =>
                Number(row.acceptedShares) === Number(row.numberOfShares)
                  ? "Accepted"
                  : Number(row.acceptedShares)
                    ? "Partially accepted"
                    : "Excluded",
              {
                header: "Status",
                meta: { filterOptions: ["Accepted", "Partially accepted", "Excluded"] },
                cell: (info) => (
                  <Status variant={info.getValue().toLowerCase().includes("accepted") ? "success" : "secondary"}>
                    {info.getValue()}
                  </Status>
                ),
              },
            )
          : null,
        isOpen
          ? columnHelper.display({
              id: "actions",
              cell: (info) =>
                info.row.original.companyInvestor.user.id === user.id ? (
                  <Button size="icon" variant="outline" onClick={() => setCancelingBid(info.row.original)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null,
            })
          : null,
      ].filter((column) => !!column),
    [user.roles.administrator, user.id, isOpen],
  );

  const bidsTable = useTable({
    data: bids,
    columns,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: user.roles.administrator ? getFilteredRowModel() : undefined!,
  });

  return (
    <EquityLayout
      pageTitle={data.name}
      headerActions={
        !bids.length || !user.roles.administrator ? (
          <BuybackActions data={data} user={user} bids={bids} isOpen={isOpen} onSetActiveModal={setActiveModal} />
        ) : null
      }
    >
      {user.roles.investor?.investedInAngelListRuv ? (
        <Alert variant="destructive">
          <ExclamationTriangleIcon />
          <AlertDescription>
            Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV itself.
            Please contact them for more information about this process.
          </AlertDescription>
        </Alert>
      ) : null}
      {!user.roles.administrator &&
      data.acceptedPriceCents &&
      (!data.equityBuybackRounds.length || data.equityBuybackRounds.some((round) => round.status !== "Paid")) ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            This buyback is now under review. The company is finalizing bids, and you'll be notified once it's settled.
          </AlertDescription>
        </Alert>
      ) : null}

      {!user.roles.administrator &&
      data.acceptedPriceCents &&
      data.equityBuybackRounds.length &&
      data.equityBuybackRounds.every((round) => round.status === "Paid") ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            This buyback has been settled. All accepted bids cleared at {formatMoneyFromCents(data.acceptedPriceCents)}
            per share, and payouts have been processed.
          </AlertDescription>
        </Alert>
      ) : null}

      {bids.length > 0 ? (
        <DataTable
          table={bidsTable}
          searchColumn={user.roles.administrator ? "investor" : undefined}
          actions={
            user.roles.administrator ? (
              <BuybackActions
                data={data}
                user={user}
                bids={bids}
                isOpen={isOpen}
                onSetActiveModal={setActiveModal}
                table={bidsTable}
              />
            ) : null
          }
        />
      ) : user.roles.administrator ? (
        <Placeholder icon={InboxIcon}>
          Investors can place bids now. Activity will appear here as it happens.
        </Placeholder>
      ) : (
        <Placeholder icon={LucideCircleDollarSign}>Place your first bid to participate in the buyback.</Placeholder>
      )}

      {cancelingBid ? (
        <Dialog open onOpenChange={() => setCancelingBid(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel bid?</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to cancel this bid?</p>
            <p>
              Share class: {cancelingBid.shareClass}
              <br />
              Number of shares: {cancelingBid.numberOfShares.toLocaleString()}
              <br />
              Bid price: {formatMoneyFromCents(cancelingBid.sharePriceCents)}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelingBid(null)}>
                No, keep bid
              </Button>
              <MutationButton
                mutation={destroyMutation}
                param={{ companyId: company.id, id: cancelingBid.id }}
                loadingText="Canceling..."
              >
                Yes, cancel bid
              </MutationButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <PlaceBidModal isOpen={activeModal === "place"} onClose={() => setActiveModal(null)} tenderOffer={data} />

      <FinalizeBuybackModal
        isOpen={activeModal === "summary"}
        onClose={() => setActiveModal(null)}
        onNext={() => setActiveModal("review")}
        tenderOffer={data}
        bids={bids}
      />

      <ReviewInvestorsModal
        isOpen={activeModal === "review"}
        onClose={() => setActiveModal(null)}
        onNext={() => setActiveModal("confirm")}
        onBack={() => setActiveModal("summary")}
        bids={bids}
      />

      <ConfirmPaymentModal
        isOpen={activeModal === "confirm"}
        onClose={() => setActiveModal(null)}
        onBack={() => setActiveModal("review")}
        bids={bids}
        mutation={finalizeMutation}
        tenderOffer={data}
      />
    </EquityLayout>
  );
}
