"use client";
import { utc } from "@date-fns/utc";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { isFuture, isPast } from "date-fns";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MutationButton from "@/components/MutationButton";
import TableSkeleton from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { VESTED_SHARES_CLASS } from "..";
import PlaceBidModal from "../PlaceBidModal";
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

export default function BuybackView() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [data] = trpc.tenderOffers.get.useSuspenseQuery({ companyId: company.id, id });
  const isOpen = isPast(utc(data.startsAt)) && isFuture(utc(data.endsAt));
  const investorId = user.roles.investor?.id;

  const startDate = new Date(data.startsAt);
  const quarter = Math.ceil((startDate.getMonth() + 1) / 3);
  const year = startDate.getFullYear();
  const buybackName = `Q${quarter} ${year} Buyback`;

  const [showPlaceBidModal, setShowPlaceBidModal] = useState(false);

  useEffect(() => {
    if (searchParams.get("openModal") === "true") {
      setShowPlaceBidModal(true);
    }
  }, [searchParams]);
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
      <DashboardHeader
        breadcrumbs={[
          { label: "Equity", href: "/equity" },
          { label: "Buybacks", href: "/equity/tender_offers" },
          { label: buybackName },
        ]}
        headerActions={
          <div className="flex gap-2">
            {data.attachment ? (
              <Button variant="outline" asChild>
                <Link href={`/download/${data.attachment.key}/${data.attachment.filename}`}>
                  <ArrowDownTrayIcon className="mr-2 h-5 w-5" />
                  Download documents
                </Link>
              </Button>
            ) : null}
            {(isOpen && holdings.length) || user.roles.administrator ? (
              <Button variant="primary" onClick={() => setShowPlaceBidModal(true)}>
                Place bid
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="px-4 pb-4">
        {user.roles.investor?.investedInAngelListRuv ? (
          <Alert variant="destructive">
            <ExclamationTriangleIcon />
            <AlertDescription>
              Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV
              itself. Please contact them for more information about this process.
            </AlertDescription>
          </Alert>
        ) : null}

        {bids.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground mb-4 text-center">
              Place your first bid to participate in the buyback.
            </div>
          </div>
        ) : null}

        {isLoading ? <TableSkeleton columns={5} /> : bids.length > 0 ? <DataTable table={bidsTable} /> : null}

        <PlaceBidModal
          open={showPlaceBidModal}
          onOpenChange={setShowPlaceBidModal}
          tenderOfferId={id}
          companyId={company.id}
          companyName={company.name || ""}
          startsAt={data.startsAt}
          endsAt={data.endsAt}
          minimumValuation={data.minimumValuation}
          attachmentKey={data.attachment?.key}
          attachmentFilename={data.attachment?.filename}
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
