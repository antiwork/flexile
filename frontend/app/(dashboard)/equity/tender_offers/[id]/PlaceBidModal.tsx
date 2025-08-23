import { zodResolver } from "@hookform/resolvers/zod";
import Decimal from "decimal.js";
import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { VESTED_SHARES_CLASS } from "@/app/(dashboard)/equity/tender_offers";
import ComboBox from "@/components/ComboBox";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import SignForm from "@/components/SignForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCurrentCompany, useCurrentUser } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoney } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";

type TenderOffer = RouterOutput["tenderOffers"]["get"];

type PlaceBidModalProps = {
  tenderOfferId: string;
  onClose: () => void;
  data: TenderOffer;
};

type BidStepProps = {
  open: boolean;
  onNext: () => void;
  onBack: () => void;
  data: TenderOffer;
  tenderOfferId: string;
  mutation: ReturnType<typeof trpc.tenderOffers.bids.create.useMutation>;
};

const formSchema = z.object({
  shareClass: z.string().min(1, "This field is required"),
  numberOfShares: z.number().min(1),
  pricePerShare: z.number().min(0),
});

type BuybackBidFormValues = z.infer<typeof formSchema>;

const ConfirmationSection = ({ onNext, data }: BidStepProps) => {
  const company = useCurrentCompany();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Buyback details</DialogTitle>
        <DialogDescription>
          Review the buyback terms below and continue to confirm your participation.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-0">
        <div className="flex justify-between border-b border-gray-200 pb-4">
          <span className="font-medium">Start date</span>
          <span>{formatDate(data.startsAt)}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">End date</span>
          <span>{formatDate(data.endsAt)}</span>
        </div>

        {data.minimumValuation ? (
          <div className="flex justify-between border-b border-gray-200 py-4">
            <span className="font-medium">Starting valuation</span>
            <span>{formatMoney(data.minimumValuation)}</span>
          </div>
        ) : null}

        {company.fullyDilutedShares && data.minimumValuation ? (
          <div className="flex justify-between border-b border-gray-200 py-4">
            <span className="font-medium">Starting price per share</span>
            <span>{formatMoney(new Decimal(data.minimumValuation.toString()).div(company.fullyDilutedShares))}</span>
          </div>
        ) : null}

        {data.attachment ? (
          <div className="flex justify-between border-b border-gray-200 py-4">
            <span className="font-medium">Buyback documents</span>
            <Button asChild variant="outline" size="small">
              <Link href={`/download/${data.attachment.key}/${data.attachment.filename}`}>
                <Download className="size-4" />
                Download
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0">
        <Button onClick={onNext} className="w-full sm:w-auto">
          Continue
        </Button>
      </DialogFooter>
    </>
  );
};

const LetterOfTransmittalSection = ({ onBack, onNext, data }: BidStepProps) => {
  const [reviewed, setReviewed] = useState(false);
  const [signed, setSigned] = useState(false);
  const [showDocument, setShowDocument] = useState(false);

  const canContinue = reviewed && signed;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Letter of transmittal</DialogTitle>
        <DialogDescription>
          Review and sign the Letter of Transmittal to confirm your participation in this buyback.
        </DialogDescription>
      </DialogHeader>

      <div>
        {showDocument ? (
          <article aria-label="Letter of transmittal">
            <SignForm content={data.letterOfTransmittal} signed={signed} onSign={() => setSigned(true)} />
          </article>
        ) : null}

        <div className="mt-auto grid shrink-0 gap-4 pt-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="reviewed"
              checked={reviewed}
              onCheckedChange={() => setReviewed(!reviewed)}
              className="shrink-0"
            />
            <label htmlFor="reviewed" className="cursor-pointer text-sm leading-tight font-medium">
              I've reviewed the{" "}
              <span
                className="text-blue-600 underline hover:text-blue-800"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowDocument(!showDocument);
                }}
              >
                Letter of Transmittal
              </span>
            </label>
          </div>
        </div>
      </div>

      <DialogFooter className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <Button
          onClick={() => onNext()}
          disabled={!canContinue}
          className={`w-full sm:w-24 ${!canContinue ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Continue
        </Button>
      </DialogFooter>
    </>
  );
};

const SubmitBidSection = ({ onBack, mutation, data, tenderOfferId }: BidStepProps) => {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const investorId = user.roles.investor?.id;

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
      [
        ...(ownShareHoldings || []),
        ...(ownTotalVestedShares ? [{ className: VESTED_SHARES_CLASS, count: ownTotalVestedShares }] : []),
      ].filter(Boolean),
    [ownShareHoldings, ownTotalVestedShares],
  );

  const form = useForm<BuybackBidFormValues>({
    defaultValues: { shareClass: holdings[0]?.className ?? "" },
    resolver: zodResolver(formSchema),
  });

  const numberOfShares = form.watch("numberOfShares") || 0;
  const pricePerShare = form.watch("pricePerShare") || 0;
  const shareClass = form.watch("shareClass");
  const maxShares = holdings.find((h) => h.className === shareClass)?.count || 0;
  const impliedValuation = company.fullyDilutedShares ? company.fullyDilutedShares * pricePerShare : 0;
  const totalAmount = new Decimal(numberOfShares).mul(pricePerShare || 0);

  const handleSubmit = form.handleSubmit((values) => {
    if (new Decimal(values.numberOfShares).gt(maxShares)) {
      return form.setError("numberOfShares", {
        message: `Number of shares must be between 1 and ${maxShares.toLocaleString()}`,
      });
    }
    if (data.minimumValuation && company.fullyDilutedShares && impliedValuation < data.minimumValuation) {
      return form.setError("pricePerShare", {
        message: `Price per share must be at least ${formatMoney(
          new Decimal(data.minimumValuation.toString()).div(company.fullyDilutedShares),
        )}`,
      });
    }
    mutation.mutate({
      companyId: company.id,
      tenderOfferId,
      shareClass: values.shareClass,
      numberOfShares: values.numberOfShares,
      sharePriceCents: Math.round(values.pricePerShare * 100),
    });
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Place a bid</DialogTitle>
        <DialogDescription>Submit an offer to sell your shares in this buyback event.</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col space-y-4 overflow-y-auto px-1 py-1"
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
                    placeholder="Select..."
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

          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="numberOfShares"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of shares</FormLabel>
                  <FormControl>
                    <NumberInput {...field} placeholder="0" />
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
                    <NumberInput {...field} decimal prefix="$" placeholder="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Implied company valuation</span>
              <span>{formatMoney(impliedValuation)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">Total amount</span>
              <span>{formatMoney(totalAmount)}</span>
            </div>
          </div>
        </form>
      </Form>

      <DialogFooter className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <MutationStatusButton
          onClick={() => void handleSubmit()}
          mutation={mutation}
          className="w-full sm:w-auto"
          disabled={!form.formState.isValid || !numberOfShares || !pricePerShare}
        >
          Submit bid
        </MutationStatusButton>
      </DialogFooter>
    </>
  );
};

const bidSteps: React.ComponentType<BidStepProps>[] = [
  ConfirmationSection,
  LetterOfTransmittalSection,
  SubmitBidSection,
];

const PlaceTenderOfferBidModal = ({ onClose, data, tenderOfferId }: PlaceBidModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const createMutation = trpc.tenderOffers.bids.create.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  const goToNextStep = () => {
    if (currentStep < bidSteps.length - 1) {
      setCurrentStep((step) => step + 1);
    } else {
      onClose();
    }
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  return (
    <>
      {bidSteps.map((Step, idx) => (
        <Dialog key={idx} open={idx === currentStep} onOpenChange={(isOpen) => !isOpen && onClose()}>
          <DialogContent>
            <Step
              open={idx === currentStep}
              onNext={goToNextStep}
              onBack={goToPreviousStep}
              data={data}
              tenderOfferId={tenderOfferId}
              mutation={createMutation}
            />
          </DialogContent>
        </Dialog>
      ))}
    </>
  );
};

export default PlaceTenderOfferBidModal;
