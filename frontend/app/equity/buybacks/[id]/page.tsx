"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel, type Table } from "@tanstack/react-table";
import { CheckIcon, Download, InboxIcon, InfoIcon, LucideCircleDollarSign, Trash2, XIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { z } from "zod";
import { type Buyback, type BuybackBid, buybackBidSchema, buybackSchema } from "@/app/equity/buybacks";
import CancelBidModal from "@/app/equity/buybacks/CancelBidModal";
import FinalizeBuybackModal from "@/app/equity/buybacks/FinalizeBuybackModal";
import PlaceBidModal from "@/app/equity/buybacks/PlaceBidModal";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { download } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_tender_offer_bids_path, company_tender_offer_path } from "@/utils/routes";
import EquityLayout from "../../Layout";

type BuybackActionsProps = {
  buyback: Buyback;
  user: ReturnType<typeof useCurrentUser>;
  bids: BuybackBid[];
  onSetActiveModal: (modal: "place" | "finalize" | "cancel" | null) => void;
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
    <div className="flex flex-wrap items-center gap-2">
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
      {user.roles.administrator && buyback.accepted_price_cents && !buyback.equity_buyback_round_count ? (
        <Button size="small" onClick={() => onSetActiveModal("finalize")}>
          Finalize buyback
        </Button>
      ) : null}
      {buyback.open && !buyback.equity_buyback_round_count ? (
        <Button size="small" onClick={() => onSetActiveModal("place")}>
          Place bid
        </Button>
      ) : null}
    </div>
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

  const [activeModal, setActiveModal] = useState<"place" | "finalize" | "cancel" | null>(null);

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
                cell: (info) =>
                  info.getValue().toLowerCase() === "accepted" ? (
                    <div className="inline-flex items-center gap-2">
                      <span className="bg-green inline-flex h-4 w-4 items-center justify-center rounded-full text-white">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                      {info.getValue()}
                    </div>
                  ) : info.getValue().toLowerCase() === "partially accepted" ? (
                    <div className="inline-flex items-center gap-2">
                      <span className="border-green from-green h-4 w-4 rounded-full border-2 bg-gradient-to-r from-50% to-transparent to-50%" />
                      {info.getValue()}
                    </div>
                  ) : info.getValue().toLowerCase() === "excluded" ? (
                    <div className="inline-flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-white">
                        <XIcon className="h-3 w-3" />
                      </span>
                      {info.getValue()}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2"> {info.getValue()}</div>
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
      pageTitle={
        <div className="gap-2">
          {buyback.name}
          {buyback.equity_buyback_round_count ? (
            <Badge variant="outline" className="border-muted text-muted-foreground ml-4 rounded-full">
              Closed and Settled
            </Badge>
          ) : null}
        </div>
      }
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
            <span className="font-semibold"> This buyback is now under review.</span> The company is finalizing bids,
            and you'll be notified once it's settled.
          </AlertDescription>
        </Alert>
      ) : null}

      {user.roles.administrator && buyback.accepted_price_cents && !buyback.equity_buyback_round_count ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            <span className="font-semibold">Buyback window has ended.</span> All accepted bids cleared at{" "}
            <span className="font-semibold">{formatMoneyFromCents(buyback.accepted_price_cents)} per share</span>.
            Review and confirm to begin processing payouts.
          </AlertDescription>
        </Alert>
      ) : null}

      {!user.roles.administrator && buyback.accepted_price_cents && buyback.equity_buyback_round_count ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            <span className="font-semibold">This buyback has been settled.</span> All accepted bids cleared at{" "}
            <span className="font-semibold">{formatMoneyFromCents(buyback.accepted_price_cents)} per share</span>, and
            payouts have been processed.
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

      <CancelBidModal
        isOpen={activeModal === "cancel"}
        onClose={() => {
          handleBidAction(null);
          void refetchBids();
        }}
        buyback={buyback}
        bid={selectedBid}
      />

      <PlaceBidModal
        isOpen={activeModal === "place"}
        onClose={() => {
          setActiveModal(null);
          void refetchBids();
        }}
        buyback={buyback}
      />

      <FinalizeBuybackModal
        isOpen={activeModal === "finalize"}
        onClose={() => {
          setActiveModal(null);
          void refetchBuyback();
          void refetchBids();
        }}
        buyback={buyback}
        bids={bids}
      />
    </EquityLayout>
  );
}
