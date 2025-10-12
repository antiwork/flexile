"use client";
import { utc } from "@date-fns/utc";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { isFuture, isPast } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MutationButton from "@/components/MutationButton";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { serverDateToLocal } from "@/utils/time";
import { VESTED_SHARES_CLASS } from "..";
import PlaceBidModal from "../PlaceBidModal";
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

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
  const { data: ownShareHoldings } = trpc.shareHoldings.sumByShareClass.useQuery(
    { companyId: company.id, investorId },
    { enabled: !!investorId },
  );
  const { data: ownTotalVestedShares } = trpc.equityGrants.sumVestedShares.useQuery(
    { companyId: company.id, investorId },
    { enabled: !!investorId },
  );

  const holdings = useMemo(
    () =>
      ownShareHoldings
        ? ownTotalVestedShares
          ? [...ownShareHoldings, { className: VESTED_SHARES_CLASS, count: ownTotalVestedShares }]
          : ownShareHoldings
        : [],
    [ownShareHoldings, ownTotalVestedShares],
  );

  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false);
  const [cancelingBid, setCancelingBid] = useState<Bid | null>(null);

  const destroyMutation = trpc.tenderOffers.bids.destroy.useMutation({
    onSuccess: async () => {
      setCancelingBid(null);
      await refetchBids();
    },
  });

  const columnHelper = createColumnHelper<Bid>();
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
                  <Button onClick={() => setCancelingBid(info.row.original)}>
                    <TrashIcon className="size-4" />
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
      <DashboardHeader title={`Buyback details ("Sell Elections")`} />
      <div className="px-4 pb-4">
        {user.roles.investor?.investedInAngelListRuv ? (
          <Alert className="mx-4" variant="destructive">
            <ExclamationTriangleIcon />
            <AlertDescription>
              Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV
              itself. Please contact them for more information about this process.
            </AlertDescription>
          </Alert>
        ) : null}

        <h2 className="text-xl font-medium">Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Start date</Label>
            <p>{serverDateToLocal(data.startsAt)}</p>
          </div>
          <div>
            <Label>End date</Label>
            <p>{serverDateToLocal(data.endsAt)}</p>
          </div>
          <div>
            <Label>Starting valuation</Label>
            <p>{formatMoney(data.minimumValuation)}</p>
          </div>
          <div className="sm:col-span-2">
            <div className="flex gap-2">
              {data.attachment ? (
                <Button asChild>
                  <Link href={`/download/${data.attachment.key}/${data.attachment.filename}`}>
                    <ArrowDownTrayIcon className="mr-2 h-5 w-5" />
                    Download buyback documents
                  </Link>
                </Button>
              ) : null}
              {(isOpen && holdings.length) || user.roles.administrator ? (
                <Button variant="primary" onClick={() => setShowPlaceBidModal(true)}>
                  Place Bid
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {bids.length > 0 ? (
          <>
            <Separator />
            <h2 className="text-xl font-medium">Bids</h2>
          </>
        ) : null}

        {isLoading ? <TableSkeleton columns={5} /> : bids.length > 0 ? <DataTable table={bidsTable} /> : null}

        <PlaceBidModal
          open={showPlaceBidModal}
          onOpenChange={setShowPlaceBidModal}
          tenderOfferId={id}
          companyId={company.id}
          companyName={company.name || ""}
          letterOfTransmittal={data.letterOfTransmittal}
          holdings={holdings}
          {...(company.fullyDilutedShares !== null && { fullyDilutedShares: company.fullyDilutedShares })}
          refetchBids={refetchBids}
        />

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
                  idleVariant="critical"
                  param={{ companyId: company.id, id: cancelingBid.id }}
                  loadingText="Canceling..."
                >
                  Yes, cancel bid
                </MutationButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </>
  );
}
