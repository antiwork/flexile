import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogStackContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_tender_offer_bids_path } from "@/utils/routes";
import { formatServerDate } from "@/utils/time";
import { type Buyback, placeBuybackBidSchema, VESTED_SHARES_CLASS } from ".";

type PlaceBidModalProps = {
  isOpen: boolean;
  onClose: () => void;
  buyback: Buyback | null;
};

type ConfirmationSectionProps = {
  onNext: () => void;
  buyback: Buyback;
};

type LetterOfTransmittalSectionProps = {
  onBack: () => void;
  onNext: () => void;
  buyback: Buyback;
};

type SubmitBidSectionProps = {
  onBack: () => void;
  buyback: Buyback;
  mutation: UseMutationResult<unknown, unknown, BuybackBidFormValues>;
};

const formSchema = placeBuybackBidSchema
  .pick({
    share_class: true,
    number_of_shares: true,
  })
  .extend({
    share_price: z.number({ coerce: true }).min(0),
  });

type BuybackBidFormValues = z.infer<typeof formSchema>;

const PlaceBidModal = ({ isOpen, onClose, buyback }: PlaceBidModalProps) => {
  const company = useCurrentCompany();
  const [currentStep, setCurrentStep] = useState(0);

  const createMutation = useMutation({
    mutationFn: async (data: BuybackBidFormValues) => {
      if (!buyback) {
        throw new Error("Buyback is required");
      }
      await request({
        method: "POST",
        url: company_tender_offer_bids_path(company.id, buyback.id),
        accept: "json",
        jsonData: placeBuybackBidSchema.parse({
          number_of_shares: Number(data.number_of_shares),
          share_price_cents: Math.round(Number(data.share_price) * 100),
          share_class: data.share_class,
        }),
        assertOk: true,
      });
    },
    onSuccess: () => {
      onClose();
    },
  });

  const goToNextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  const goToPreviousStep = () => {
    setCurrentStep(currentStep - 1);
  };

  if (!buyback) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogStackContent step={currentStep}>
        <ConfirmationSection buyback={buyback} onNext={goToNextStep} />

        <LetterOfTransmittalSection onBack={goToPreviousStep} onNext={goToNextStep} buyback={buyback} />

        <SubmitBidSection onBack={goToPreviousStep} buyback={buyback} mutation={createMutation} />
      </DialogStackContent>
    </Dialog>
  );
};

const ConfirmationSection = ({ onNext, buyback }: ConfirmationSectionProps) => {
  const company = useCurrentCompany();
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Buyback confirmation</DialogTitle>
        <DialogDescription>
          Review the buyback terms below and continue to confirm your participation.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-0">
        <div className="flex justify-between border-b border-gray-200 pb-4">
          <span className="font-medium">Start date</span>
          <span>{formatServerDate(new Date(buyback.starts_at))}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">End date</span>
          <span>{formatServerDate(new Date(buyback.ends_at))}</span>
        </div>

        {buyback.buyback_type === "tender_offer" ? (
          <div className="flex justify-between border-b border-gray-200 py-4">
            <span className="font-medium">Starting valuation</span>
            <span>{formatMoney(buyback.minimum_valuation)}</span>
          </div>
        ) : null}

        {buyback.buyback_type === "single_stock" && company.valuationInDollars ? (
          <div className="flex justify-between border-b border-gray-200 py-4">
            <span className="font-medium">Company valuation</span>
            <span>{formatMoney(company.valuationInDollars)}</span>
          </div>
        ) : null}

        {buyback.starting_price_per_share_cents && buyback.buyback_type === "tender_offer" ? (
          <div className="flex justify-between border-b border-gray-200 py-4">
            <span className="font-medium">Starting price per share</span>
            <span>{formatMoneyFromCents(buyback.starting_price_per_share_cents)}</span>
          </div>
        ) : null}

        {buyback.starting_price_per_share_cents &&
        buyback.total_amount_in_cents &&
        buyback.buyback_type === "single_stock" ? (
          <>
            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">Price per share</span>
              <span>{formatMoneyFromCents(buyback.starting_price_per_share_cents)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">Allocation limit</span>
              <span>{buyback.total_amount_in_cents / buyback.starting_price_per_share_cents}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">Maximum payout</span>
              <span>{formatMoneyFromCents(buyback.total_amount_in_cents)}</span>
            </div>
          </>
        ) : null}

        {buyback.attachment ? (
          <div className="flex justify-between border-b border-gray-200 py-4">
            <span className="font-medium">Buyback documents</span>
            <Button asChild variant="outline" size="small">
              <Link href={`/download/${buyback.attachment.key}/${buyback.attachment.filename}`}>
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
    </div>
  );
};

const LetterOfTransmittalSection = ({ onBack, onNext, buyback }: LetterOfTransmittalSectionProps) => {
  const user = useCurrentUser();
  const [hasReviewed, setHasReviewed] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [showDocument, setShowDocument] = useState(false);

  const handleContinue = () => {
    if (hasReviewed && hasSigned) {
      onNext();
    }
  };

  const canContinue = hasReviewed && hasSigned;

  const pdfUrl = buyback.letter_of_transmittal
    ? `/download/${buyback.letter_of_transmittal.key}/${encodeURIComponent(buyback.letter_of_transmittal.filename)}?inline=true`
    : null;

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Letter of transmittal</DialogTitle>
        <DialogDescription>
          Review and sign the Letter of Transmittal to confirm your participation in this buyback.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {showDocument && pdfUrl ? (
          <div className="mb-4 flex-1">
            {/* eslint-disable-next-line -- can't use sandbox for pdf embeds */}
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              className="h-full min-h-105 w-full border-none bg-white"
              title="Letter of Transmittal"
            />
          </div>
        ) : null}

        <div className="mt-auto grid shrink-0 gap-4 pt-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="reviewed"
              checked={hasReviewed}
              onCheckedChange={() => setHasReviewed(!hasReviewed)}
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

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Your signature</p>
            {hasSigned ? (
              <div className="font-signature mb-2 border-b pb-2 text-2xl sm:text-3xl">{user.legalName}</div>
            ) : (
              <Button variant="dashed" onClick={() => setHasSigned(true)} className="mb-2 w-full">
                Add your signature
              </Button>
            )}
            <p className="text-xs leading-relaxed text-gray-500">
              By clicking the button above, you agree to using an electronic representation of your signature for all
              purposes within Flexile, just the same as a pen-and-paper signature.
            </p>
          </div>
        </div>
      </div>

      <DialogFooter className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className={`w-full sm:w-24 ${!canContinue ? "cursor-not-allowed opacity-50" : ""}`}
        >
          Continue
        </Button>
      </DialogFooter>
    </div>
  );
};

const SubmitBidSection = ({ onBack, mutation, buyback }: SubmitBidSectionProps) => {
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
      ownShareHoldings
        ? ownTotalVestedShares
          ? [...ownShareHoldings, { className: VESTED_SHARES_CLASS, count: ownTotalVestedShares }]
          : ownShareHoldings
        : [],
    [ownShareHoldings, ownTotalVestedShares],
  );

  const form = useForm<BuybackBidFormValues>({
    defaultValues: { share_class: holdings[0]?.className ?? "", share_price: 0, number_of_shares: 0 },
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (buyback.buyback_type === "single_stock" && buyback.starting_price_per_share_cents) {
      form.setValue("share_price", buyback.starting_price_per_share_cents / 100);
    }
  }, [buyback.buyback_type, buyback.starting_price_per_share_cents]);

  const numberOfShares = form.watch("number_of_shares");
  const pricePerShare = form.watch("share_price");
  const shareClass = form.watch("share_class");
  const maxShares = holdings.find((h) => h.className === shareClass)?.count || 0;

  const handleSubmit = form.handleSubmit((values) => {
    const allocationLimit =
      buyback.buyback_type === "single_stock" && buyback.total_amount_in_cents && buyback.starting_price_per_share_cents
        ? Math.min(buyback.total_amount_in_cents / buyback.starting_price_per_share_cents, maxShares)
        : maxShares;
    if (values.number_of_shares > allocationLimit) {
      return form.setError("number_of_shares", {
        message: `Number of shares must be between 1 and ${allocationLimit.toLocaleString()}`,
      });
    }
    mutation.mutate(values);
  });

  const impliedValuation = company.fullyDilutedShares ? company.fullyDilutedShares * pricePerShare : 0;
  const totalAmount = numberOfShares * pricePerShare;

  return (
    <div className="space-y-4">
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
            name="share_class"
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

          <div
            className={cn(
              buyback.buyback_type === "tender_offer" && "grid grid-cols-2 items-start gap-4 sm:grid-cols-2",
            )}
          >
            <FormField
              control={form.control}
              name="number_of_shares"
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

            {buyback.buyback_type === "tender_offer" ? (
              <FormField
                control={form.control}
                name="share_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per share</FormLabel>
                    <FormControl>
                      <NumberInput {...field} decimal prefix="$" placeholder="$ 0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            {buyback.buyback_type === "tender_offer" ? (
              <div className="flex justify-between text-sm">
                <span className="font-medium">Implied company valuation</span>
                <span>{formatMoney(impliedValuation)}</span>
              </div>
            ) : null}
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
    </div>
  );
};

export default PlaceBidModal;
