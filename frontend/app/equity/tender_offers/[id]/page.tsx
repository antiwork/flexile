"use client";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { isFuture, isPast } from "date-fns";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/components/layouts/Main";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatServerDate } from "@/utils/time";
import { VESTED_SHARES_CLASS } from "../";
import LetterOfTransmissal from "./LetterOfTransmissal";
import ComboBox from "@/components/ComboBox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField, FormItem, FormControl, FormLabel, FormMessage } from "@/components/ui/form";
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

const formSchema = z.object({
  shareClass: z.string().min(1, "This field is required"),
  numberOfShares: z.number().min(1),
  pricePerShare: z.number().min(0),
});

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

  const form = useForm({
    defaultValues: { shareClass: holdings[0]?.className ?? "" },
    resolver: zodResolver(formSchema),
  });
  const pricePerShare = form.watch("pricePerShare");
  const [signed, setSigned] = useState(false);
  const [cancelingBid, setCancelingBid] = useState<Bid | null>(null);
  const maxShares = holdings.find((h) => h.className === form.watch("shareClass"))?.count || 0;

  const createMutation = trpc.tenderOffers.bids.create.useMutation({
    onSuccess: async () => {
      form.reset();
      await refetchBids();
    },
  });
  const destroyMutation = trpc.tenderOffers.bids.destroy.useMutation({
    onSuccess: async () => {
      setCancelingBid(null);
      await refetchBids();
    },
  });

  const submit = form.handleSubmit(async (values) => {
    if (values.numberOfShares > maxShares)
      return form.setError("numberOfShares", {
        message: `Number of shares must be between 1 and ${maxShares.toLocaleString()}`,
      });
    await createMutation.mutateAsync({
      companyId: company.id,
      tenderOfferId: id,
      numberOfShares: Number(values.numberOfShares),
      sharePriceCents: Math.round(Number(values.pricePerShare) * 100),
      shareClass: values.shareClass,
    });
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

      <h2 className="text-xl font-medium">Details</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start date</Label>
          <p>{formatServerDate(data.startsAt)}</p>
        </div>
        <div>
          <Label>End date</Label>
          <p>{formatServerDate(data.endsAt)}</p>
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
      </div>

      {isOpen && holdings.length ? (
        <>
          <Separator />
          <h2 className="text-xl font-medium">Letter of transmittal</h2>
          <div>
            <div>
              THIS DOCUMENT AND THE INFORMATION REFERENCED HEREIN OR PROVIDED TO YOU IN CONNECTION WITH THIS OFFER TO
              PURCHASE CONSTITUTES CONFIDENTIAL INFORMATION REGARDING GUMROAD, INC., A DELAWARE CORPORATION (THE
              "COMPANY"). BY OPENING OR READING THIS DOCUMENT, YOU HEREBY AGREE TO MAINTAIN THE CONFIDENTIALITY OF SUCH
              INFORMATION AND NOT TO DISCLOSE IT TO ANY PERSON (OTHER THAN TO YOUR LEGAL, FINANCIAL AND TAX ADVISORS,
              AND THEN ONLY IF THEY HAVE SIMILARLY AGREED TO MAINTAIN THE CONFIDENTIALITY OF SUCH INFORMATION), AND SUCH
              INFORMATION SHALL BE SUBJECT TO THE CONFIDENTIALITY OBLIGATIONS UNDER [THE NON-DISCLOSURE AGREEMENT
              INCLUDED] ON THE PLATFORM (AS DEFINED BELOW) AND ANY OTHER AGREEMENT YOU HAVE WITH THE COMPANY, INCLUDING
              ANY "INVENTION AND NON-DISCLOSURE AGREEMENT", "CONFIDENTIALITY, INVENTION AND NON-SOLICITATION AGREEMENT"
              OR OTHER NONDISCLOSURE AGREEMENT. BY YOU ACCEPTING TO RECEIVE THIS OFFER TO PURCHASE, YOU ACKNOWLEDGE AND
              AGREE TO THE FOREGOING RESTRICTIONS.
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
          </div>

          <Separator />
          <h2 className="text-xl font-medium">Submit a bid ("Sell Order")</h2>
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <FormField
              control={form.control}
              name="shareClass"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Share class</FormLabel>
                  <FormControl>
                    <ComboBox
                      {...field}
                      options={holdings.map((holding) => ({
                        value: holding.className,
                        label: `${holding.className} (${holding.count.toLocaleString()} shares)`,
                      }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="numberOfShares"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of shares</FormLabel>
                  <FormControl>
                    <NumberInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pricePerShare"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price per share</FormLabel>
                  <FormControl>
                    <NumberInput {...field} decimal prefix="$" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {company.fullyDilutedShares ? (
              <div>
                <strong>Implied company valuation:</strong> {formatMoney(company.fullyDilutedShares * pricePerShare)}
              </div>
            ) : null}
            <div>
              <strong>Total amount:</strong> {formatMoney(form.getValues("numberOfShares") * pricePerShare)}
            </div>
            <MutationStatusButton type="submit" mutation={createMutation} className="justify-self-end">
              Submit bid
            </MutationStatusButton>
          </form>
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
