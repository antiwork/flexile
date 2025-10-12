"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import SignForm from "@/components/SignForm";
import { StepIndicator } from "@/components/StepIndicator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";

type Holding = { className: string; count: number };

interface StepProps {
  open: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}

interface PlaceBidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenderOfferId: string;
  companyId: string;
  companyName: string;
  letterOfTransmittal: string;
  holdings: Holding[];
  fullyDilutedShares?: number;
  refetchBids: () => Promise<void>;
}

const bidFormSchema = z.object({
  shareClass: z.string().min(1, "This field is required"),
  numberOfShares: z.number().min(1),
  pricePerShare: z.number().min(0),
});

type BidFormValues = z.infer<typeof bidFormSchema>;

const STEP_LABELS = ["Review & Sign", "Enter Bid", "Review & Submit"];
const TOTAL_STEPS = STEP_LABELS.length;
const FIRST_STEP = 0;
const LAST_STEP = TOTAL_STEPS - 1;

function ReviewAndSignStep({
  open,
  onNext,
  onClose,
  letterOfTransmittal,
  companyName,
  signed,
  onSign,
}: StepProps & { letterOfTransmittal: string; companyName: string; signed: boolean; onSign: () => void }) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Letter of Transmittal</DialogTitle>
          <StepIndicator currentStep={1} totalSteps={TOTAL_STEPS} stepLabels={STEP_LABELS} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="text-sm">
            THIS DOCUMENT AND THE INFORMATION REFERENCED HEREIN OR PROVIDED TO YOU IN CONNECTION WITH THIS OFFER TO
            PURCHASE CONSTITUTES CONFIDENTIAL INFORMATION REGARDING {companyName.toUpperCase()} (THE "COMPANY"). BY
            OPENING OR READING THIS DOCUMENT, YOU HEREBY AGREE TO MAINTAIN THE CONFIDENTIALITY OF SUCH INFORMATION AND
            NOT TO DISCLOSE IT TO ANY PERSON (OTHER THAN TO YOUR LEGAL, FINANCIAL AND TAX ADVISORS, AND THEN ONLY IF
            THEY HAVE SIMILARLY AGREED TO MAINTAIN THE CONFIDENTIALITY OF SUCH INFORMATION), AND SUCH INFORMATION SHALL
            BE SUBJECT TO THE CONFIDENTIALITY OBLIGATIONS UNDER [THE NON-DISCLOSURE AGREEMENT INCLUDED] ON THE PLATFORM
            (AS DEFINED BELOW) AND ANY OTHER AGREEMENT YOU HAVE WITH THE COMPANY, INCLUDING ANY "INVENTION AND
            NON-DISCLOSURE AGREEMENT", "CONFIDENTIALITY, INVENTION AND NON-SOLICITATION AGREEMENT" OR OTHER
            NONDISCLOSURE AGREEMENT. BY YOU ACCEPTING TO RECEIVE THIS OFFER TO PURCHASE, YOU ACKNOWLEDGE AND AGREE TO
            THE FOREGOING RESTRICTIONS.
          </div>

          <Separator />

          <SignForm content={letterOfTransmittal} signed={signed} onSign={onSign} />
        </div>

        <DialogFooter>
          <Button variant="primary" onClick={onNext} disabled={!signed}>
            Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BidDetailsStep({
  open,
  onNext,
  onBack,
  onClose,
  form,
  holdings,
  fullyDilutedShares,
  maxShares,
}: StepProps & {
  form: UseFormReturn<BidFormValues>;
  holdings: Holding[];
  fullyDilutedShares?: number;
  maxShares: number;
}) {
  if (!open) return null;

  const pricePerShare = form.watch("pricePerShare");
  const numberOfShares = form.watch("numberOfShares");

  const handleNext = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      return;
    }

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

    onNext();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enter Bid Details</DialogTitle>
          <StepIndicator currentStep={2} totalSteps={TOTAL_STEPS} stepLabels={STEP_LABELS} />
        </DialogHeader>

        <Form {...form}>
          <div className="grid gap-4">
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

            {fullyDilutedShares ? (
              <div>
                <strong>Implied company valuation:</strong> {formatMoney(fullyDilutedShares * pricePerShare)}
              </div>
            ) : null}

            <div>
              <strong>Total amount:</strong> {formatMoney(numberOfShares * pricePerShare)}
            </div>
          </div>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button variant="primary" onClick={() => void handleNext()}>
            Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewAndSubmitStep({
  open,
  onBack,
  onClose,
  formValues,
  fullyDilutedShares,
  createMutation,
  onSubmit,
}: StepProps & {
  formValues: BidFormValues;
  fullyDilutedShares?: number;
  createMutation: ReturnType<typeof trpc.tenderOffers.bids.create.useMutation>;
  onSubmit: () => Promise<void>;
}) {
  if (!open) return null;

  const totalAmount = formValues.numberOfShares * formValues.pricePerShare;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review & Submit</DialogTitle>
          <StepIndicator currentStep={3} totalSteps={TOTAL_STEPS} stepLabels={STEP_LABELS} />
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground text-sm">Share class</p>
            <p className="font-medium">{formValues.shareClass}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Number of shares</p>
            <p className="font-medium">{formValues.numberOfShares.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Price per share</p>
            <p className="font-medium">${formValues.pricePerShare}</p>
          </div>
          {fullyDilutedShares ? (
            <div>
              <p className="text-muted-foreground text-sm">Implied company valuation</p>
              <p className="font-medium">{formatMoney(fullyDilutedShares * formValues.pricePerShare)}</p>
            </div>
          ) : null}
          <div className="border-t pt-2">
            <p className="text-muted-foreground text-sm">Total amount</p>
            <p className="text-lg font-bold">{formatMoney(totalAmount)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <MutationStatusButton
            idleVariant="primary"
            mutation={createMutation}
            onClick={() => void onSubmit()}
            loadingText="Submitting..."
          >
            Submit bid
          </MutationStatusButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlaceBidModal({
  open,
  onOpenChange,
  tenderOfferId,
  companyId,
  companyName,
  letterOfTransmittal,
  holdings,
  fullyDilutedShares,
  refetchBids,
}: PlaceBidModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
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
    setCurrentStep(FIRST_STEP);
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

    await createMutation.mutateAsync({
      companyId,
      tenderOfferId,
      numberOfShares: Number(values.numberOfShares),
      sharePriceCents: Math.round(Number(values.pricePerShare) * 100),
      shareClass: values.shareClass,
    });
  };

  const goToNext = () => setCurrentStep((s) => Math.min(s + 1, LAST_STEP));
  const goToBack = () => setCurrentStep((s) => Math.max(s - 1, FIRST_STEP));

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <>
      <ReviewAndSignStep
        open={currentStep === 0}
        onNext={goToNext}
        onBack={goToBack}
        onClose={handleClose}
        letterOfTransmittal={letterOfTransmittal}
        companyName={companyName}
        signed={signed}
        onSign={() => setSigned(true)}
      />
      <BidDetailsStep
        open={currentStep === 1}
        onNext={goToNext}
        onBack={goToBack}
        onClose={handleClose}
        form={form}
        holdings={holdings}
        {...(fullyDilutedShares !== undefined && { fullyDilutedShares })}
        maxShares={maxShares}
      />
      <ReviewAndSubmitStep
        open={currentStep === 2}
        onNext={goToNext}
        onBack={goToBack}
        onClose={handleClose}
        formValues={form.getValues()}
        {...(fullyDilutedShares !== undefined && { fullyDilutedShares })}
        createMutation={createMutation}
        onSubmit={handleSubmit}
      />
    </>
  );
}
