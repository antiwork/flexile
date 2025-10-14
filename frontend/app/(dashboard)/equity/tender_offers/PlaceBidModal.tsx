"use client";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import SignForm from "@/components/SignForm";
import { Button } from "@/components/ui/button";
import {
  DialogStack,
  DialogStackBody,
  DialogStackContent,
  DialogStackDescription,
  DialogStackFooter,
  DialogStackHeader,
  DialogStackNext,
  DialogStackPrevious,
  DialogStackTitle,
} from "@/components/ui/dialog-stack";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";

type Holding = { className: string; count: number };

interface PlaceBidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenderOfferId: string;
  companyId: string;
  companyName: string;
  startsAt: Date | string;
  endsAt: Date | string;
  minimumValuation: number;
  attachmentKey?: string;
  attachmentFilename?: string;
  letterOfTransmittal: string;
  holdings: Holding[];
  fullyDilutedShares?: number;
  refetchBids: () => Promise<unknown>;
}

const bidFormSchema = z.object({
  shareClass: z.string().min(1, "This field is required"),
  numberOfShares: z.number().min(1),
  pricePerShare: z.number().min(0),
});

export default function PlaceBidModal({
  open,
  onOpenChange,
  tenderOfferId,
  companyId,
  companyName,
  startsAt,
  endsAt,
  minimumValuation,
  attachmentKey,
  attachmentFilename,
  letterOfTransmittal,
  holdings,
  fullyDilutedShares,
  refetchBids,
}: PlaceBidModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [signed, setSigned] = useState(false);

  const form = useForm({
    resolver: zodResolver(bidFormSchema),
    defaultValues: {
      shareClass: holdings[0]?.className ?? "",
      numberOfShares: 0,
      pricePerShare: 0,
    },
  });

  const maxShares = holdings.find((h) => h.className === form.watch("shareClass"))?.count || 0;

  const resetForm = () => {
    form.reset(
      {
        shareClass: holdings[0]?.className ?? "",
        numberOfShares: 0,
        pricePerShare: 0,
      },
      {
        keepErrors: false,
        keepDirty: false,
        keepIsSubmitted: false,
        keepTouched: false,
        keepIsValid: false,
        keepSubmitCount: false,
      },
    );
    setSigned(false);
    setActiveIndex(0);
  };

  const createMutation = trpc.tenderOffers.bids.create.useMutation({
    onSuccess: async () => {
      resetForm();
      await refetchBids();
      onOpenChange(false);
    },
  });

  const handleSubmit = async () => {
    const values = form.getValues();

    if (values.numberOfShares > maxShares) {
      form.setError("numberOfShares", {
        message: `Number of shares must be between 1 and ${maxShares.toLocaleString()}`,
      });
      return;
    }

    if (values.pricePerShare <= 0) {
      form.setError("pricePerShare", {
        message: "Price per share must be greater than 0",
      });
      return;
    }

    await createMutation.mutateAsync({
      companyId,
      tenderOfferId,
      numberOfShares: Number(values.numberOfShares),
      sharePriceCents: Math.round(Number(values.pricePerShare) * 100),
      shareClass: values.shareClass,
    });
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const pricePerShare = form.watch("pricePerShare");
  const numberOfShares = form.watch("numberOfShares");

  return (
    <DialogStack
      open={open}
      onOpenChange={(isOpen) => (isOpen ? undefined : handleClose())}
      activeIndex={activeIndex}
      setActiveIndex={setActiveIndex}
    >
      <DialogStackBody>
        <DialogStackContent>
          <DialogStackHeader>
            <DialogStackTitle>Buyback details</DialogStackTitle>
          </DialogStackHeader>
          <p className="text-muted-foreground mb-2">
            Review the buyback terms below and continue to confirm your participation.
          </p>

          <div className="grid gap-4">
            <div className="border-muted-foreground flex items-center justify-between border-b pb-4">
              <span className="text-base font-medium">Start date</span>
              <span className="text-base">{formatDate(startsAt)}</span>
            </div>
            <div className="border-muted-foreground flex items-center justify-between border-b pb-4">
              <span className="text-base font-medium">End date</span>
              <span className="text-base">{formatDate(endsAt)}</span>
            </div>
            <div className="border-muted-foreground flex items-center justify-between border-b pb-4">
              <span className="text-base font-medium">Starting valuation</span>
              <span className="text-base">{formatMoney(minimumValuation)}</span>
            </div>
            <div className="border-muted-foreground flex items-center justify-between border-b pb-4">
              <span className="text-base font-medium">Starting price per share</span>
              <span className="text-base">
                {fullyDilutedShares ? formatMoney(Number(minimumValuation) / Number(fullyDilutedShares)) : "N/A"}
              </span>
            </div>
            {attachmentKey && attachmentFilename ? (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-base font-medium">Buyback documents</span>
                <Button variant="outline" asChild>
                  <Link href={`/download/${attachmentKey}/${attachmentFilename}`}>
                    <ArrowDownTrayIcon className="mr-2 h-5 w-5" />
                    Download
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          <DialogStackFooter>
            <DialogStackNext>
              <Button variant="primary" className="w-full">
                Continue
              </Button>
            </DialogStackNext>
          </DialogStackFooter>
        </DialogStackContent>

        <DialogStackContent>
          <DialogStackHeader>
            <DialogStackTitle>Letter of Transmittal</DialogStackTitle>
          </DialogStackHeader>
          {activeIndex === 1 && (
            <div className="flex-1 overflow-y-auto">
              <DialogStackDescription>
                Review and sign the Letter of Transmittal to confirm your participation in this buyback.
              </DialogStackDescription>
              <div className="mt-6 text-sm">
                THIS DOCUMENT AND THE INFORMATION REFERENCED HEREIN OR PROVIDED TO YOU IN CONNECTION WITH THIS OFFER TO
                PURCHASE CONSTITUTES CONFIDENTIAL INFORMATION REGARDING {companyName.toUpperCase()} (THE "COMPANY"). BY
                OPENING OR READING THIS DOCUMENT, YOU HEREBY AGREE TO MAINTAIN THE CONFIDENTIALITY OF SUCH INFORMATION
                AND NOT TO DISCLOSE IT TO ANY PERSON (OTHER THAN TO YOUR LEGAL, FINANCIAL AND TAX ADVISORS, AND THEN
                ONLY IF THEY HAVE SIMILARLY AGREED TO MAINTAIN THE CONFIDENTIALITY OF SUCH INFORMATION), AND SUCH
                INFORMATION SHALL BE SUBJECT TO THE CONFIDENTIALITY OBLIGATIONS UNDER [THE NON-DISCLOSURE AGREEMENT
                INCLUDED] ON THE PLATFORM (AS DEFINED BELOW) AND ANY OTHER AGREEMENT YOU HAVE WITH THE COMPANY,
                INCLUDING ANY "INVENTION AND NON-DISCLOSURE AGREEMENT", "CONFIDENTIALITY, INVENTION AND NON-SOLICITATION
                AGREEMENT" OR OTHER NONDISCLOSURE AGREEMENT. BY YOU ACCEPTING TO RECEIVE THIS OFFER TO PURCHASE, YOU
                ACKNOWLEDGE AND AGREE TO THE FOREGOING RESTRICTIONS.
              </div>

              <Separator />

              <article aria-label="Letter of transmittal" className="flex flex-col gap-4">
                <SignForm content={letterOfTransmittal} signed={signed} onSign={() => setSigned(true)} />
              </article>
            </div>
          )}
          <DialogStackFooter>
            <DialogStackPrevious>
              <Button variant="outline">Back</Button>
            </DialogStackPrevious>
            <DialogStackNext>
              <Button variant="primary" disabled={!signed}>
                Continue
              </Button>
            </DialogStackNext>
          </DialogStackFooter>
        </DialogStackContent>

        <DialogStackContent>
          <DialogStackHeader>
            <DialogStackTitle>Place a bid</DialogStackTitle>
          </DialogStackHeader>
          <p className="text-muted-foreground mb-2">Submit an offer to sell your shares in this buyback event.</p>

          <Form {...form}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="contents"
            >
              <FormField
                control={form.control}
                name="shareClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Share class</FormLabel>
                    <FormControl>
                      <ComboBox
                        {...field}
                        options={holdings.map((h) => ({
                          value: h.className,
                          label: `${h.className} (${h.count.toLocaleString()} shares)`,
                        }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              {fullyDilutedShares ? (
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">Implied company valuation</span>
                  <span className="text-base">{formatMoney(fullyDilutedShares * pricePerShare)}</span>
                </div>
              ) : null}

              <div className="mb-2 flex items-center justify-between">
                <span className="text-base font-semibold">Total amount</span>
                <span className="text-base">{formatMoney(numberOfShares * pricePerShare)}</span>
              </div>

              <DialogStackFooter>
                <DialogStackPrevious>
                  <Button variant="outline">Back</Button>
                </DialogStackPrevious>
                <MutationStatusButton
                  type="submit"
                  idleVariant="primary"
                  mutation={createMutation}
                  loadingText="Submitting..."
                >
                  Submit bid
                </MutationStatusButton>
              </DialogStackFooter>
            </form>
          </Form>
        </DialogStackContent>
      </DialogStackBody>
    </DialogStack>
  );
}
