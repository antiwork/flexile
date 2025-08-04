"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { getFilteredRowModel, getSortedRowModel, type Table } from "@tanstack/react-table";
import Decimal from "decimal.js";
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
import { getBuybackStatus } from "@/app/(dashboard)/equity/tender_offers";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { download } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatNumber } from "@/utils/numbers";
import CancelBidModal from "./CancelBidModal";
import PlaceBidModal from "./PlaceBidModal";

type TenderOffer = RouterOutput["tenderOffers"]["get"];
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

type BuybackActionsProps = {
  data: TenderOffer;
  user: ReturnType<typeof useCurrentUser>;
  bids: Bid[];
  onSetActiveModal: (modal: "place" | "cancel" | null) => void;
  table?: Table<Bid>;
};

const BuybackActions = ({ data, user, bids, onSetActiveModal, table }: BuybackActionsProps) => {
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
      {getBuybackStatus(data) === "Open" ? (
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
  const [data] = trpc.tenderOffers.get.useSuspenseQuery({ companyId: company.id, id });
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
  const [activeModal, setActiveModal] = useState<"place" | "cancel" | null>(null);

  const handleBidAction = (bid: Bid | null, action?: "cancel") => {
    setSelectedBid(bid);
    setActiveModal(action || null);
  };

  const columns = useMemo(
    () =>
      [
        user.roles.administrator
          ? columnHelper.accessor("companyInvestor.user.name", {
              id: "investor",
              header: "Investor",
              cell: (info) => info.getValue(),
              footer: getBuybackStatus(data) !== "Open" ? "Total payout" : "",
            })
          : null,
        columnHelper.simple("shareClass", "Share class"),
        columnHelper.simple("numberOfShares", "Shares", (value) => formatNumber(value)),
        user.roles.administrator || getBuybackStatus(data) !== "Open"
          ? columnHelper.accessor("acceptedShares", {
              id: "acceptedShares",
              header: "Accepted",
              cell: (info) => formatNumber(info.getValue()),
              footer:
                getBuybackStatus(data) !== "Open"
                  ? formatNumber(bids.reduce((sum, bid) => sum.plus(bid.acceptedShares), new Decimal(0)))
                  : "",
            })
          : null,
        (user.roles.administrator || getBuybackStatus(data) !== "Open") && data.acceptedPriceCents
          ? columnHelper.display({
              id: "clearingPrice",
              header: "Clearing Price",
              cell: (info) =>
                info.row.original.acceptedShares && getBuybackStatus(data) !== "Open" && data.acceptedPriceCents
                  ? formatMoneyFromCents(data.acceptedPriceCents)
                  : "—",
              footer: getBuybackStatus(data) !== "Open" ? formatMoneyFromCents(data.acceptedPriceCents) : "",
            })
          : null,
        columnHelper.simple("sharePriceCents", "Bid price", formatMoneyFromCents),
        columnHelper.display({
          id: "total",
          header: "Total",
          cell: (info) =>
            getBuybackStatus(data) !== "Open" && data.acceptedPriceCents
              ? info.row.original.acceptedShares
                ? formatMoneyFromCents(new Decimal(info.row.original.acceptedShares).mul(data.acceptedPriceCents))
                : "—"
              : formatMoneyFromCents(
                  new Decimal(info.row.original.numberOfShares).mul(info.row.original.sharePriceCents),
                ),
          footer:
            getBuybackStatus(data) !== "Open" && data.acceptedPriceCents
              ? formatMoneyFromCents(
                  bids.reduce(
                    (sum, bid) => sum.plus(new Decimal(bid.acceptedShares).mul(data.acceptedPriceCents || 0)),
                    new Decimal(0),
                  ),
                )
              : "",
        }),
        getBuybackStatus(data) !== "Open"
          ? columnHelper.accessor(
              (row) =>
                new Decimal(row.acceptedShares).eq(row.numberOfShares)
                  ? "Accepted"
                  : new Decimal(row.acceptedShares).gt(0)
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
        getBuybackStatus(data) === "Open"
          ? columnHelper.display({
              id: "actions",
              cell: (info) =>
                info.row.original.companyInvestor.user.id === user.id ? (
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
    [user.roles.administrator, user.roles.investor?.id, data, bids],
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
          <div className="flex flex-wrap items-end gap-x-4">
            {data.name}
            {getBuybackStatus(data) === "Settled" ? (
              <Badge variant="outline" className="border-muted text-muted-foreground rounded-full text-sm">
                Closed and Settled
              </Badge>
            ) : null}
            {getBuybackStatus(data) === "Closed" ? (
              <Badge variant="outline" className="border-muted text-muted-foreground rounded-full text-sm">
                Closed
              </Badge>
            ) : null}
          </div>
        }
        headerActions={
          !bids.length || !user.roles.administrator ? (
            <BuybackActions data={data} user={user} bids={bids} onSetActiveModal={setActiveModal} />
          ) : null
        }
      />
      {user.roles.investor?.investedInAngelListRuv ? (
        <Alert className="mx-4" variant="destructive">
          {" "}
          <ExclamationTriangleIcon />
          <AlertDescription>
            Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV itself.
            Please contact them for more information about this process.
          </AlertDescription>
        </Alert>
      ) : null}
      {!user.roles.administrator && getBuybackStatus(data) === "Reviewing" ? (
        <Alert className="mx-4">
          <InfoIcon />
          <AlertDescription>
            <span className="font-semibold"> This buyback is now under review.</span> The company is finalizing bids,
            and you'll be notified once it's settled.
          </AlertDescription>
        </Alert>
      ) : null}
      {user.roles.administrator && data.acceptedPriceCents && getBuybackStatus(data) === "Reviewing" ? (
        <Alert className="mx-4">
          <InfoIcon />
          <AlertDescription>
            <span className="font-semibold">Buyback window has ended.</span> All accepted bids cleared at{" "}
            <span className="font-semibold">{formatMoneyFromCents(data.acceptedPriceCents)} per share</span>. Review and
            confirm to begin processing payouts.
          </AlertDescription>
        </Alert>
      ) : null}
      {user.roles.administrator && getBuybackStatus(data) === "Closed" ? (
        <Alert className="mx-4" variant="success">
          <CircleCheckIcon />
          <AlertDescription>
            <span className="font-semibold">Buyback successfully closed and settled.</span> Payouts are being processed.
          </AlertDescription>
        </Alert>
      ) : null}
      {!user.roles.administrator && data.acceptedPriceCents && getBuybackStatus(data) === "Settled" ? (
        <Alert className="mx-4">
          <InfoIcon />
          <AlertDescription>
            <span className="font-semibold">This buyback has been settled.</span> All accepted bids cleared at{" "}
            <span className="font-semibold">{formatMoneyFromCents(data.acceptedPriceCents)} per share</span>, and
            payouts have been processed.
          </AlertDescription>
        </Alert>
      ) : null}
      {isLoading ? (
        <TableSkeleton columns={columns.length} />
      ) : bids.length > 0 ? (
        <DataTable
          table={bidsTable}
          searchColumn={user.roles.administrator ? "investor" : undefined}
          actions={
            user.roles.administrator ? (
              <BuybackActions data={data} user={user} bids={bids} onSetActiveModal={setActiveModal} table={bidsTable} />
            ) : null
          }
        />
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
      {activeModal === "cancel" ? (
        <CancelBidModal
          onClose={() => {
            handleBidAction(null);
            void refetchBids();
          }}
          data={data}
          bid={selectedBid}
        />
      ) : null}
      {activeModal === "place" ? (
        <PlaceBidModal
          onClose={() => {
            setActiveModal(null);
            void refetchBids();
          }}
          data={data}
        />
      ) : null}
    </>
  );
}
