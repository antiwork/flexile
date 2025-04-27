"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { addMonths, isFuture, isPast } from "date-fns";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Figures from "@/components/Figures";
import MainLayout from "@/components/layouts/Main";
import Modal from "@/components/Modal";
import MutationButton from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import Select from "@/components/Select";
import Status from "@/components/Status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate, formatMonth } from "@/utils/time";
import { VESTED_SHARES_CLASS } from "../";
import LetterOfTransmissal from "./LetterOfTransmissal";

type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];
type Holding = RouterOutput["shareHoldings"]["sumByShareClass"][number];

const financialData = Object.entries({
  Cash: [
    11045655, 12563729, 13238776, 13332966, 15671365, 16100626, 15877174, 17083710, 18002925, 18641588, 12811052,
    13877618,
  ],
  "Adj. Cash Burn": [193431, 1141761, 675424, 94296, 2838506, -67436, 366262, 599093, 1712333, -225429, 108033, 455763],
  "Seller Liability": [
    2909181, 2846985, 2263331, 2581491, 4018653, 2590252, 3029511, 2375900, 2763081, 2779627, 2495106, 2360422,
  ],
  "Net Income": [654869, 833621, 756529, 574325, 869527, 825233, 739546, 722330, 845423, 606748, 654413, 132492],
  "Adj. Net Income": [707205, 894141, 822531, 606595, 892851, 859164, 699931, 697105, 836988, 588833, 649632, 118897],
  "Adj. Opex": [358564, 351281, 327985, 405688, 455951, 409139, 560015, 569946, 568698, 578979, 597302, 579388],
  "Months Cash": ["n/a", "n/a", "n/a", "n/a", "n/a", 239, "n/a", "n/a", "n/a", 83, "n/a", "n/a"],
  "Months Cash After Seller Liab": ["n/a", "n/a", "n/a", "n/a", "n/a", 200, "n/a", "n/a", "n/a", 70, "n/a", "n/a"],
  "Months Cash @ Adj. NI": ["n/a", "n/a", "n/a", "n/a", "n/a", "n/a", "n/a", "n/a", "n/a", "n/a", "n/a", "n/a"],
  "Net Working Capital": [
    7468791, 8341795, 9164015, 9773445, 10668768, 11533761, 12241553, 12947131, 13774293, 13910264, 9217045, 9352394,
  ],
});
const startDate = new Date(2023, 6);

const HoldingsTable = ({ holdings, caption }: { holdings: Holding[]; caption: string }) => (
  <Table>
    <TableCaption>{caption}</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Share class</TableHead>
        <TableHead className="text-right">Number of shares</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {holdings.map((holding, index) => (
        <TableRow key={index}>
          <TableCell>{holding.className}</TableCell>
          <TableCell className="text-right tabular-nums">{holding.count.toLocaleString()}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default function BuybackView() {
  const { id } = useParams<{ id: string }>();
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [data] = trpc.tenderOffers.get.useSuspenseQuery({ companyId: company.id, id });
  const isOpen = isPast(data.startsAt) && isFuture(data.endsAt);
  const investorId = user.activeRole === "administrator" ? undefined : user.roles.investor?.id;
  const [bids, { refetch: refetchBids }] = trpc.tenderOffers.bids.list.useSuspenseQuery({
    companyId: company.id,
    tenderOfferId: id,
    investorId,
  });
  const { data: ownShareHoldings } = trpc.shareHoldings.sumByShareClass.useQuery(
    { companyId: company.id, investorId },
    { enabled: !!investorId },
  );
  const { data: shareHoldings } = trpc.shareHoldings.sumByShareClass.useQuery(
    { companyId: company.id },
    { enabled: !!investorId },
  );
  const { data: ownTotalVestedShares } = trpc.equityGrants.sumVestedShares.useQuery(
    { companyId: company.id, investorId },
    { enabled: !!investorId },
  );
  const { data: totalVestedShares } = trpc.equityGrants.sumVestedShares.useQuery(
    { companyId: company.id },
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
  const tenderedHoldings = useMemo(
    () =>
      shareHoldings
        ? totalVestedShares
          ? [...shareHoldings, { className: VESTED_SHARES_CLASS, count: totalVestedShares }]
          : shareHoldings
        : [],
    [shareHoldings, totalVestedShares],
  );

  const defaultBid = {
    shareClass: holdings[0]?.className ?? "",
    numberOfShares: 0,
    pricePerShare: 11.38,
  };

  const [newBid, setNewBid] = useState(defaultBid);
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
        numberOfShares: newBid.numberOfShares,
        sharePriceCents: Math.round(newBid.pricePerShare * 100),
        shareClass: newBid.shareClass,
      });
    },
  });

  const columnHelper = createColumnHelper<Bid>();
  const columns = useMemo(
    () =>
      [
        columnHelper.simple("companyInvestor.user.email", "Investor", (value) =>
          user.activeRole !== "administrator" ? "You!" : value,
        ),
        columnHelper.simple("shareClass", "Share class"),
        columnHelper.simple("numberOfShares", "Number of shares", (value) => value.toLocaleString()),
        columnHelper.simple("sharePriceCents", "Bid price", formatMoneyFromCents),
        isOpen && user.activeRole !== "administrator"
          ? columnHelper.display({
              id: "actions",
              cell: (info) => (
                <Button onClick={() => setCancelingBid(info.row.original)}>
                  <TrashIcon className="size-4" />
                </Button>
              ),
            })
          : null,
      ].filter((column) => !!column),
    [user.activeRole],
  );

  const bidsTable = useTable({ data: bids, columns });

  const buttonTooltip = !signed ? "Please sign the letter of transmittal before submitting a bid" : null;

  return (
    <MainLayout title='Buyback details ("Sell Elections")'>
      <Figures
        items={[
          { caption: "Start date", value: formatDate(data.startsAt) },
          { caption: "End date", value: formatDate(data.endsAt) },
          { caption: "Starting bid valuation", value: formatMoney(data.minimumValuation) },
        ]}
      />
      {user.activeRole === "contractorOrInvestor" && user.roles.investor?.investedInAngelListRuv ? (
        <Alert variant="destructive">
          <ExclamationTriangleIcon />
          <AlertDescription>
            Note: As an investor through an AngelList RUV, your bids will be submitted on your behalf by the RUV itself.
            Please contact them for more information about this process.
          </AlertDescription>
        </Alert>
      ) : null}

      {isOpen && holdings.length ? (
        <>
          <h2 className="text-xl font-bold">
            Submit a bid (<b>"Sell Order"</b>)
          </h2>
          <form>
            <Card>
              <CardContent>
                <div>
                  THIS DOCUMENT AND THE INFORMATION REFERENCED HEREIN OR PROVIDED TO YOU IN CONNECTION WITH THIS OFFER
                  TO PURCHASE CONSTITUTES CONFIDENTIAL INFORMATION REGARDING GUMROAD, INC., A DELAWARE CORPORATION (THE
                  "COMPANY"). BY OPENING OR READING THIS DOCUMENT, YOU HEREBY AGREE TO MAINTAIN THE CONFIDENTIALITY OF
                  SUCH INFORMATION AND NOT TO DISCLOSE IT TO ANY PERSON (OTHER THAN TO YOUR LEGAL, FINANCIAL AND TAX
                  ADVISORS, AND THEN ONLY IF THEY HAVE SIMILARLY AGREED TO MAINTAIN THE CONFIDENTIALITY OF SUCH
                  INFORMATION), AND SUCH INFORMATION SHALL BE SUBJECT TO THE CONFIDENTIALITY OBLIGATIONS UNDER [THE
                  NON-DISCLOSURE AGREEMENT INCLUDED] ON THE PLATFORM (AS DEFINED BELOW) AND ANY OTHER AGREEMENT YOU HAVE
                  WITH THE COMPANY, INCLUDING ANY "INVENTION AND NON-DISCLOSURE AGREEMENT", "CONFIDENTIALITY, INVENTION
                  AND NON-SOLICITATION AGREEMENT" OR OTHER NONDISCLOSURE AGREEMENT. BY YOU ACCEPTING TO RECEIVE THIS
                  OFFER TO PURCHASE, YOU ACKNOWLEDGE AND AGREE TO THE FOREGOING RESTRICTIONS.
                </div>
                <Separator />
                <div className="flex flex-col gap-4">
                  <div className="h-96 overflow-y-auto rounded-md border p-4">
                    <div className="prose max-w-none">
                      <LetterOfTransmissal />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <div className="font-signature border-b text-3xl">{company.primaryAdminName}</div>
                      <Status variant="success">Chief Executive Officer</Status>
                    </div>
                    <div className="grid gap-2">
                      {signed ? (
                        <div className="font-signature border-b text-3xl">{user.legalName}</div>
                      ) : (
                        <Button variant="dashed" onClick={() => setSigned(true)}>
                          Add your signature
                        </Button>
                      )}
                      <Status variant={signed ? "success" : undefined} className={signed ? "text-gray-500" : ""}>
                        Investor
                      </Status>
                      <p className="text-gray-500">
                        By clicking the button above, you agree to using an electronic representation of your signature
                        for all purposes within Flexile, just the same as a pen-and-paper signature.
                      </p>
                    </div>
                  </div>
                  <h2 className="text-xl font-bold">Buyback details</h2>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableCaption>Company financials (unaudited)</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead />
                          {(financialData[0]?.[1] ?? []).map((_, index) => (
                            <TableHead key={index} className="text-right">
                              {formatMonth(addMonths(startDate, index))}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financialData.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            <TableCell>{row[0]}</TableCell>
                            {row[1].map((cell, cellIndex) => (
                              <TableCell key={cellIndex} className="text-right tabular-nums">
                                {typeof cell === "number" ? formatMoney(cell) : cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-5">
                    <Button variant="outline" asChild>
                      <a href={data.attachment ?? ""}>
                        <ArrowDownTrayIcon className="mr-2 h-5 w-5" />
                        Download buyback documents
                      </a>
                    </Button>
                  </p>
                  <h2 className="text-xl font-bold">Submit a bid</h2>
                  {tenderedHoldings.length ? (
                    <HoldingsTable holdings={tenderedHoldings} caption="Tendered Holdings" />
                  ) : null}
                  <HoldingsTable holdings={holdings} caption="Holdings" />
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
                      min={11.38}
                      invalid={newBid.pricePerShare <= 0 && submitMutation.isError}
                      className={newBid.pricePerShare <= 0 && submitMutation.isError ? "error" : ""}
                      prefix="$"
                      decimal
                    />
                    {newBid.pricePerShare <= 0 && submitMutation.isError ? (
                      <span className="text-destructive text-sm">Price per share must be greater than 0</span>
                    ) : null}
                  </div>
                  {totalAmount > 0 && (
                    <div className="info">
                      <strong>Total amount:</strong> {formatMoney(totalAmount)}
                    </div>
                  )}
                  <Alert variant="destructive">
                    <ExclamationTriangleIcon />
                    <AlertDescription>
                      <strong>Important:</strong> Please note that once submitted, commitments cannot be withdrawn or
                      changed. Make sure all information is correct before proceeding.
                    </AlertDescription>
                  </Alert>
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
            </Card>
          </form>
        </>
      ) : null}

      {bids.length > 0 ? <DataTable table={bidsTable} /> : null}

      {cancelingBid ? (
        <Modal
          open
          title="Cancel bid?"
          onClose={() => setCancelingBid(null)}
          footer={
            <>
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
            </>
          }
        >
          <>
            <p>Are you sure you want to cancel this bid?</p>
            <p>
              Share class: {cancelingBid.shareClass}
              <br />
              Number of shares: {cancelingBid.numberOfShares.toLocaleString()}
              <br />
              Bid price: {formatMoneyFromCents(cancelingBid.sharePriceCents)}
            </p>
          </>
        </Modal>
      ) : null}
    </MainLayout>
  );
}
