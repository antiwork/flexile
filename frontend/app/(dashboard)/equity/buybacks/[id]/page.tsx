"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel, type Table } from "@tanstack/react-table";
import {
  CheckIcon,
  CircleCheckIcon,
  Download,
  InboxIcon,
  InfoIcon,
  LucideCircleDollarSign,
  Trash2,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { z } from "zod";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { download } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_tender_offer_bids_path, company_tender_offer_path } from "@/utils/routes";
import { type Buyback, type BuybackBid, buybackBidSchema, buybackSchema, getBuybackStatus } from "../../buybacks";
import CancelBidModal from "../CancelBidModal";
import FinalizeBuybackModal from "../FinalizeBuybackModal";
import PlaceBidModal from "../PlaceBidModal";

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
      {user.roles.administrator && getBuybackStatus(buyback) === "Reviewing" ? (
        <Button size="small" onClick={() => onSetActiveModal("finalize")}>
          Finalize buyback
        </Button>
      ) : null}
      {getBuybackStatus(buyback) === "Open" ? (
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
    isLoading: isLoadingBids,
    data: { bids } = { bids: [] },
    refetch: refetchBids,
  } = useQuery({
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
              footer: getBuybackStatus(buyback) !== "Open" ? "Total payout" : "",
            })
          : null,
        columnHelper.simple("share_class", "Share class"),
        columnHelper.simple("number_of_shares", "Shares", (value) => value.toLocaleString()),
        user.roles.administrator || getBuybackStatus(buyback) !== "Open"
          ? columnHelper.accessor("accepted_shares", {
              id: "accepted_shares",
              header: "Accepted",
              cell: (info) => Number(info.getValue() || 0).toLocaleString(),
              footer:
                getBuybackStatus(buyback) !== "Open"
                  ? bids.reduce((sum, bid) => sum + Number(bid.accepted_shares), 0).toLocaleString()
                  : "",
            })
          : null,
        user.roles.administrator || getBuybackStatus(buyback) !== "Open"
          ? columnHelper.display({
              id: "clearing_price",
              header: "Clearing Price",
              cell: (info) =>
                info.row.original.accepted_shares && getBuybackStatus(buyback) !== "Open"
                  ? formatMoneyFromCents(buyback.accepted_price_cents)
                  : "—",
              footer: getBuybackStatus(buyback) !== "Open" ? formatMoneyFromCents(buyback.accepted_price_cents) : "",
            })
          : null,
        columnHelper.simple("share_price_cents", "Bid price", formatMoneyFromCents),
        columnHelper.display({
          id: "total",
          header: "Total",
          cell: (info) =>
            getBuybackStatus(buyback) !== "Open"
              ? info.row.original.accepted_shares
                ? formatMoneyFromCents(Number(info.row.original.accepted_shares) * buyback.accepted_price_cents)
                : "—"
              : formatMoneyFromCents(Number(info.row.original.number_of_shares) * info.row.original.share_price_cents),
          footer:
            getBuybackStatus(buyback) !== "Open"
              ? formatMoneyFromCents(
                  bids.reduce(
                    (sum, bid) => sum + Number(bid.accepted_shares || 0) * (buyback.accepted_price_cents || 0),
                    0,
                  ),
                )
              : "",
        }),
        getBuybackStatus(buyback) !== "Open"
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
        getBuybackStatus(buyback) === "Open"
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
    [user.roles.administrator, user.roles.investor?.id, buyback, bids],
  );

  const bidsTable = useTable({
    data: bids,
    columns,
    getSortedRowModel: getSortedRowModel(),
    ...(user.roles.administrator && { getFilteredRowModel: getFilteredRowModel() }),
  });

  return (
    <>
      <DashboardHeader
        title={
          <div className="gap-2">
            {buyback.name}
            {getBuybackStatus(buyback) === "Settled" ? (
              <Badge variant="outline" className="border-muted text-muted-foreground ml-4 rounded-full">
                Closed and Settled
              </Badge>
            ) : null}
            {getBuybackStatus(buyback) === "Closed" ? (
              <Badge variant="outline" className="border-muted text-muted-foreground ml-4 rounded-full">
                Closed
              </Badge>
            ) : null}
          </div>
        }
        headerActions={
          !bids.length || !user.roles.administrator ? (
            <BuybackActions buyback={buyback} user={user} bids={bids} onSetActiveModal={setActiveModal} />
          ) : null
        }
      />
      {user.roles.investor?.investedInAngelListRuv ? (
        <Alert variant="destructive">
          <ExclamationTriangleIcon />
          <AlertDescription>
            Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV itself.
            Please contact them for more information about this process.
          </AlertDescription>
        </Alert>
      ) : null}
      {!user.roles.administrator && getBuybackStatus(buyback) === "Reviewing" ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            <span className="font-semibold"> This buyback is now under review.</span> The company is finalizing bids,
            and you'll be notified once it's settled.
          </AlertDescription>
        </Alert>
      ) : null}
      {user.roles.administrator && buyback.accepted_price_cents && getBuybackStatus(buyback) === "Reviewing" ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            <span className="font-semibold">Buyback window has ended.</span> All accepted bids cleared at{" "}
            <span className="font-semibold">{formatMoneyFromCents(buyback.accepted_price_cents)} per share</span>.
            Review and confirm to begin processing payouts.
          </AlertDescription>
        </Alert>
      ) : null}
      {user.roles.administrator && getBuybackStatus(buyback) === "Closed" ? (
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertDescription>
            <span className="font-semibold">Buyback successfully closed and settled.</span> Payouts are being processed.
          </AlertDescription>
        </Alert>
      ) : null}
      {!user.roles.administrator && buyback.accepted_price_cents && getBuybackStatus(buyback) === "Settled" ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            <span className="font-semibold">This buyback has been settled.</span> All accepted bids cleared at{" "}
            <span className="font-semibold">{formatMoneyFromCents(buyback.accepted_price_cents)} per share</span>, and
            payouts have been processed.
          </AlertDescription>
        </Alert>
      ) : null}
      {isLoadingBids ? (
        <TableSkeleton columns={columns.length} />
      ) : bids.length > 0 ? (
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
      {activeModal === "cancel" ? (
        <CancelBidModal
          onClose={() => {
            handleBidAction(null);
            void refetchBids();
          }}
          buyback={buyback}
          bid={selectedBid}
        />
      ) : null}
      {activeModal === "place" ? (
        <PlaceBidModal
          onClose={() => {
            setActiveModal(null);
            void refetchBids();
          }}
          buyback={buyback}
        />
      ) : null}
      {activeModal === "finalize" ? (
        <FinalizeBuybackModal
          onClose={() => {
            setActiveModal(null);
            void refetchBuyback();
            void refetchBids();
          }}
          buyback={buyback}
          bids={bids}
        />
      ) : null}
      {user.roles.administrator ? (
        <div className="mt-auto">
          <div className="flex justify-center border-t border-gray-100 p-3">
            <span>
              <span className="font-semibold">{buyback.bid_count}</span> bid{buyback.bid_count === 1 ? "" : "s"} from{" "}
              <span className="font-semibold">{buyback.investor_count} </span>investor
              {buyback.investor_count === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
