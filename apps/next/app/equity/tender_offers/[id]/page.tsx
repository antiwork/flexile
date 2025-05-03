"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { isFuture, isPast } from "date-fns";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import FormSection from "@/components/FormSection";
import MainLayout from "@/components/layouts/Main";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import Select from "@/components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import { VESTED_SHARES_CLASS } from "../";
import LetterOfTransmissal from "./LetterOfTransmissal";

type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];
type NewBidState = {
  shareClass: string;
  numberOfShares: number;
  pricePerShare: number;
};

export default function BuybackView() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [data] = trpc.tenderOffers.get.useSuspenseQuery({ companyId: company.id, id });
  const isOpen = isPast(data.startsAt) && isFuture(data.endsAt);
  const investorId = user.roles.investor?.id;
  const [bids, { refetch: refetchBids }] = trpc.tenderOffers.bids.list.useSuspenseQuery({
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
  const defaultBid: NewBidState = { shareClass: holdings[0]?.className ?? "", numberOfShares: 0, pricePerShare: 0 };

  const [newBid, setNewBid] = useState<NewBidState>(defaultBid);
  useEffect(() => setNewBid(defaultBid), [holdings]);
  const [signed, setSigned] = useState(false);
  const [cancelingBid, setCancelingBid] = useState<Bid | null>(null);
  const totalAmount = useMemo(() => newBid.numberOfShares * newBid.pricePerShare, [newBid]);
  const maxShares = holdings.find((h) => h.className === newBid.shareClass)?.count || 0;

  const createMutation = trpc.tenderOffers.bids.create.useMutation({
    onSuccess: async () => {
      setNewBid(defaultBid);
      await refetchBids();
    },
  });
  const destroyMutation = trpc.tenderOffers.bids.destroy.useMutation({
    onSuccess: async () => {
      setCancelingBid(null);
      await refetchBids();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (
        !newBid.shareClass ||
        newBid.numberOfShares <= 0 ||
        newBid.numberOfShares > maxShares ||
        newBid.pricePerShare <= 0
      ) {
        throw new Error("Invalid bid");
      }

      await createMutation.mutateAsync({
        companyId: company.id,
        tenderOfferId: id,
        numberOfShares: Number(newBid.numberOfShares),
        sharePriceCents: Math.round(Number(newBid.pricePerShare) * 100),
        shareClass: newBid.shareClass,
      });
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

  const buttonTooltip = !signed ? "Please sign the letter of transmittal before submitting a bid" : null;

  return (
    <MainLayout title='Buyback details ("Sell Elections")'>
      {user.roles.investor?.investedInAngelListRuv ? (
        <Alert variant="destructive">
          <ExclamationTriangleIcon />
          <AlertDescription>
            Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV itself.
            Please contact them for more information about this process.
          </AlertDescription>
        </Alert>
      ) : null}

      <FormSection title="Details">
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start date</Label>
            <p>{formatDate(data.startsAt)}</p>
          </div>
          <div>
            <Label>End date</Label>
            <p>{formatDate(data.endsAt)}</p>
          </div>
          <div>
            <Label>Starting valuation</Label>
            <p>{formatMoney(data.minimumValuation)}</p>
          </div>
          <div>
            <Button asChild>
              <a href={data.attachment ?? ""}>
                <ArrowDownTrayIcon className="mr-2 h-5 w-5" />
                Download buyback documents
              </a>
            </Button>
          </div>
        </CardContent>
      </FormSection>

      {isOpen && holdings.length ? (
        <>
          <FormSection title="Letter of transmittal">
            <CardContent>
              <div>
                THIS DOCUMENT AND THE INFORMATION REFERENCED HEREIN OR PROVIDED TO YOU IN CONNECTION WITH THIS OFFER TO
                PURCHASE CONSTITUTES CONFIDENTIAL INFORMATION REGARDING GUMROAD, INC., A DELAWARE CORPORATION (THE
                "COMPANY"). BY OPENING OR READING THIS DOCUMENT, YOU HEREBY AGREE TO MAINTAIN THE CONFIDENTIALITY OF
                SUCH INFORMATION AND NOT TO DISCLOSE IT TO ANY PERSON (OTHER THAN TO YOUR LEGAL, FINANCIAL AND TAX
                ADVISORS, AND THEN ONLY IF THEY HAVE SIMILARLY AGREED TO MAINTAIN THE CONFIDENTIALITY OF SUCH
                INFORMATION), AND SUCH INFORMATION SHALL BE SUBJECT TO THE CONFIDENTIALITY OBLIGATIONS UNDER [THE
                NON-DISCLOSURE AGREEMENT INCLUDED] ON THE PLATFORM (AS DEFINED BELOW) AND ANY OTHER AGREEMENT YOU HAVE
                WITH THE COMPANY, INCLUDING ANY "INVENTION AND NON-DISCLOSURE AGREEMENT", "CONFIDENTIALITY, INVENTION
                AND NON-SOLICITATION AGREEMENT" OR OTHER NONDISCLOSURE AGREEMENT. BY YOU ACCEPTING TO RECEIVE THIS OFFER
                TO PURCHASE, YOU ACKNOWLEDGE AND AGREE TO THE FOREGOING RESTRICTIONS.
              </div>
              <Separator />
              <div className="flex flex-col gap-4">
                <div className="h-96 overflow-y-auto rounded-md border p-4">
                  <div className="prose max-w-none">
                    <LetterOfTransmissal />
                  </div>
                </div>
                <div className="grid gap-3">
                  {signed ? (
                    <div className="font-signature border-b text-3xl">{user.legalName}</div>
                  ) : (
                    <Button variant="dashed" onClick={() => setSigned(true)}>
                      Add your signature
                    </Button>
                  )}
                  <p className="text-gray-500">
                    By clicking the button above, you agree to using an electronic representation of your signature for
                    all purposes within Flexile, just the same as a pen-and-paper signature.
                  </p>
                </div>
              </div>
            </CardContent>
          </FormSection>

          <FormSection title={`Submit a bid ("Sell Order")`}>
            <CardContent>
              <div className="flex flex-col gap-4">
                <Select
                  value={newBid.shareClass}
                  onChange={(value) => setNewBid({ ...newBid, shareClass: value })}
                  label="Share class"
                  invalid={!newBid.shareClass && submitMutation.isError}
                  help={!newBid.shareClass && submitMutation.isError ? "Please select a share class" : ""}
                  options={holdings.map((holding) => ({
                    value: holding.className,
                    label: `${holding.className} (${holding.count.toLocaleString()} shares)`,
                  }))}
                />
                <div className="grid gap-2">
                  <Label htmlFor="number-of-shares">Number of shares</Label>
                  <NumberInput
                    id="number-of-shares"
                    value={newBid.numberOfShares}
                    onChange={(value) => setNewBid({ ...newBid, numberOfShares: value ?? 0 })}
                    invalid={
                      (newBid.numberOfShares <= 0 || newBid.numberOfShares > maxShares) && submitMutation.isError
                    }
                  />
                  {(newBid.numberOfShares <= 0 || newBid.numberOfShares > maxShares) && submitMutation.isError ? (
                    <span className="text-destructive text-sm">
                      Number of shares must be between 1 and {maxShares.toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price-per-share">Price per share</Label>
                  <NumberInput
                    id="price-per-share"
                    value={newBid.pricePerShare}
                    onChange={(value) => setNewBid({ ...newBid, pricePerShare: value ?? 0 })}
                    invalid={newBid.pricePerShare <= 0 && submitMutation.isError}
                    className={newBid.pricePerShare <= 0 && submitMutation.isError ? "error" : ""}
                    prefix="$"
                    decimal
                  />
                  {newBid.pricePerShare <= 0 && submitMutation.isError ? (
                    <span className="text-destructive text-sm">Price per share must be greater than 0</span>
                  ) : null}
                </div>
                {company.fullyDilutedShares ? (
                  <div className="info">
                    <strong>Implied company valuation:</strong>{" "}
                    {formatMoney(company.fullyDilutedShares * newBid.pricePerShare)}
                  </div>
                ) : null}
                {totalAmount > 0 && (
                  <div className="info">
                    <strong>Total amount:</strong> {formatMoney(totalAmount)}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Tooltip>
                <TooltipTrigger asChild={signed}>
                  <MutationButton mutation={submitMutation} disabled={!signed}>
                    Submit bid
                  </MutationButton>
                </TooltipTrigger>
                <TooltipContent>{buttonTooltip}</TooltipContent>
              </Tooltip>
            </CardFooter>
          </FormSection>
        </>
      ) : null}

      {bids.length > 0 ? <DataTable table={bidsTable} /> : null}

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
    </MainLayout>
  );
}
