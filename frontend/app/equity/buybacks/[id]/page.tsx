"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel, type Table } from "@tanstack/react-table";
import { Download, InboxIcon, InfoIcon, LucideCircleDollarSign, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { z } from "zod";
import { type Buyback, type BuybackBid, buybackBidSchema, buybackSchema } from "@/app/equity/buybacks";
import ConfirmPaymentModal from "@/app/equity/buybacks/ConfirmPaymentModal";
import FinalizeBuybackModal from "@/app/equity/buybacks/FinalizeBuybackModal";
import PlaceBidModal from "@/app/equity/buybacks/PlaceBidModal";
import ReviewInvestorsModal from "@/app/equity/buybacks/ReviewInvestorsModal";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MutationButton from "@/components/MutationButton";
import Placeholder from "@/components/Placeholder";
import Status from "@/components/Status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { download } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import {
  company_tender_offer_bid_path,
  company_tender_offer_bids_path,
  company_tender_offer_path,
  finalize_company_tender_offer_path,
} from "@/utils/routes";
import EquityLayout from "../../Layout";

type BuybackActionsProps = {
  buyback: Buyback;
  user: ReturnType<typeof useCurrentUser>;
  bids: BuybackBid[];
  onSetActiveModal: (modal: "place" | "summary" | "review" | "confirm" | null) => void;
  table?: Table<BuybackBid>;
};

const BuybackActions = ({ buyback, user, bids, onSetActiveModal, table }: BuybackActionsProps) => {
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
      {buyback.attachment ? (
        <Button asChild size="small" variant="outline">
          <Link href={`/download/${buyback.attachment.key}/${buyback.attachment.filename}`}>
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
      {user.roles.administrator && !buyback.open && bids.length && !buyback.equity_buyback_round_count ? (
        <Button size="small" onClick={() => onSetActiveModal("summary")}>
          Finalize buyback
        </Button>
      ) : null}
      {buyback.open ? (
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

  const {
    data: { buyback },
    refetch: refetchBuyback,
  } = useSuspenseQuery({
    queryKey: ["buybacks", company.id, id],
    queryFn: async () => {
      const response = await request({
        accept: "json",
        method: "GET",
        url: company_tender_offer_path(company.id, id),
        assertOk: true,
      });
      return z
        .object({
          buyback: buybackSchema,
        })
        .parse(await response.json());
    },
  });

  const {
    data: { bids },
    refetch: refetchBids,
  } = useSuspenseQuery({
    queryKey: ["buybacks", "bids", company.id, id],
    queryFn: async () => {
      const response = await request({
        accept: "json",
        method: "GET",
        url: company_tender_offer_bids_path(company.id, id),
        assertOk: true,
      });
      return z
        .object({
          bids: z.array(buybackBidSchema),
        })
        .parse(await response.json());
    },
  });

  const [selectedBid, setSelectedBid] = useState<BuybackBid | null>(null);

  const [activeModal, setActiveModal] = useState<"place" | "summary" | "review" | "confirm" | "cancel" | null>(null);

  const destroyMutation = useMutation({
    mutationFn: async ({ bidId }: { bidId: string }) => {
      await request({
        method: "DELETE",
        url: company_tender_offer_bid_path(company.id, id, bidId),
        accept: "json",
        assertOk: true,
      });
    },
    onSuccess: async () => {
      handleBidAction(null);
      await refetchBids();
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      await request({
        method: "POST",
        url: finalize_company_tender_offer_path(company.id, id),
        accept: "json",
        assertOk: true,
        jsonData: {},
      });
    },
    onSuccess: async () => {
      setActiveModal(null);
      await refetchBuyback();
      await refetchBids();
    },
  });

  const handleBidAction = (bid: BuybackBid | null, action?: "cancel") => {
    setSelectedBid(bid);
    setActiveModal(action || null);
  };

  const columnHelper = createColumnHelper<BuybackBid>();
  const columns = useMemo(
    () =>
      [
        user.roles.administrator
          ? columnHelper.accessor("investor.name", {
              id: "investor",
              header: "Investor",
              cell: (info) => info.getValue(),
              footer: buyback.accepted_price_cents ? "Total payout" : "",
            })
          : null,
        columnHelper.simple("share_class", "Share class"),
        columnHelper.simple("number_of_shares", "Shares", (value) => value.toLocaleString()),
        user.roles.administrator || buyback.accepted_price_cents
          ? columnHelper.accessor("accepted_shares", {
              id: "accepted_shares",
              header: "Accepted",
              cell: (info) => Number(info.getValue() || 0).toLocaleString(),
              footer: buyback.accepted_price_cents
                ? bids.reduce((sum, bid) => sum + Number(bid.accepted_shares), 0).toLocaleString()
                : "",
            })
          : null,
        user.roles.administrator || buyback.accepted_price_cents
          ? columnHelper.display({
              id: "clearing_price",
              header: "Clearing Price",
              cell: (info) =>
                info.row.original.accepted_shares && buyback.accepted_price_cents
                  ? formatMoneyFromCents(buyback.accepted_price_cents)
                  : "-",
              footer: buyback.accepted_price_cents ? formatMoneyFromCents(buyback.accepted_price_cents) : "",
            })
          : null,
        columnHelper.simple("share_price_cents", "Bid price", formatMoneyFromCents),
        columnHelper.display({
          id: "total",
          header: "Total",
          cell: (info) =>
            formatMoneyFromCents(Number(info.row.original.number_of_shares) * info.row.original.share_price_cents), // TODO confirm this calculation
          footer: buyback.accepted_price_cents
            ? formatMoneyFromCents(
                bids.reduce(
                  (sum, bid) => sum + Number(bid.accepted_shares || 0) * (buyback.accepted_price_cents || 0),
                  0,
                ),
              )
            : "",
        }),
        buyback.accepted_price_cents
          ? columnHelper.accessor(
              (row) =>
                Number(row.accepted_shares) === Number(row.number_of_shares)
                  ? "Accepted"
                  : Number(row.accepted_shares)
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
        buyback.open
          ? columnHelper.display({
              id: "actions",
              cell: (info) =>
                info.row.original.investor.id === user.roles.investor?.id ? (
                  <Button
                    className="size-9"
                    variant="outline"
                    onClick={() => handleBidAction(info.row.original, "cancel")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null,
            })
          : null,
      ].filter((column) => !!column),
    [user.roles.administrator, user.roles.investor?.id, buyback.open, buyback.accepted_price_cents, bids],
  );

  const bidsTable = useTable({
    data: bids,
    columns,
    getSortedRowModel: getSortedRowModel(),
    ...(user.roles.administrator && { getFilteredRowModel: getFilteredRowModel() }),
  });

  return (
    <EquityLayout
      pageTitle={buyback.name}
      headerActions={
        !bids.length || !user.roles.administrator ? (
          <BuybackActions buyback={buyback} user={user} bids={bids} onSetActiveModal={setActiveModal} />
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
      {!user.roles.administrator && buyback.accepted_price_cents && !buyback.equity_buyback_round_count ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            This buyback is now under review. The company is finalizing bids, and you'll be notified once it's settled.
          </AlertDescription>
        </Alert>
      ) : null}

      {!user.roles.administrator && buyback.accepted_price_cents && buyback.equity_buyback_round_count ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            This buyback has been settled. All accepted bids cleared at{" "}
            {formatMoneyFromCents(buyback.accepted_price_cents)}
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
                buyback={buyback}
                user={user}
                bids={bids}
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

      {selectedBid ? (
        <Dialog open={activeModal === "cancel"} onOpenChange={() => handleBidAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel bid?</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to cancel this bid?</p>
            <p>
              Share class: {selectedBid.share_class}
              <br />
              Number of shares: {selectedBid.number_of_shares.toLocaleString()}
              <br />
              BuybackBid price: {formatMoneyFromCents(selectedBid.share_price_cents)}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleBidAction(null)}>
                No, keep bid
              </Button>
              <MutationButton mutation={destroyMutation} param={{ bidId: selectedBid.id }} loadingText="Canceling...">
                Yes, cancel bid
              </MutationButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <PlaceBidModal isOpen={activeModal === "place"} onClose={() => setActiveModal(null)} buyback={buyback} />

      <FinalizeBuybackModal
        isOpen={activeModal === "summary"}
        onClose={() => setActiveModal(null)}
        onNext={() => setActiveModal("review")}
        buyback={buyback}
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
        buyback={buyback}
      />
    </EquityLayout>
  );
}
