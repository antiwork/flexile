import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { Download } from "lucide-react";
import React, { useState } from "react";
import type { Buyback, BuybackBid } from "@/app/equity/buybacks";
import { MutationStatusButton } from "@/components/MutationButton";
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
import { useCurrentCompany } from "@/global";
import { download } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { finalize_company_tender_offer_path } from "@/utils/routes";

type FinalizeBuybackModalProps = {
  onClose: () => void;
  buyback: Buyback;
  bids: BuybackBid[];
};

type ConfirmationSectionProps = {
  buyback: Buyback;
  bids: BuybackBid[];
  onNext: () => void;
};

type ReviewInvestorsSectionProps = {
  onNext: () => void;
  onBack: () => void;
  bids: BuybackBid[];
};

type SubmitSectionProps = {
  onBack: () => void;
  buyback: Buyback;
  bids: BuybackBid[];
  mutation: UseMutationResult<unknown, unknown, void>;
};

type SingleBuybackConfirmationSectionProps = {
  buyback: Buyback;
  bids: BuybackBid[];
  mutation: UseMutationResult<unknown, unknown, void>;
  onNext: () => void;
};

type SingleBuybackReviewSectionProps = {
  buyback: Buyback;
  bids: BuybackBid[];
  mutation: UseMutationResult<unknown, unknown, void>;
  onBack: () => void;
};

const FinalizeBuybackModal = ({ onClose, buyback, bids }: FinalizeBuybackModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const company = useCurrentCompany();

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      await request({
        method: "POST",
        url: finalize_company_tender_offer_path(company.id, buyback.id),
        accept: "json",
        assertOk: true,
        jsonData: {},
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogStackContent step={currentStep}>
        {buyback.buyback_type === "single_stock"
          ? [
              <SingleBuybackConfirmationSection
                key="single-buyback-confirmation"
                buyback={buyback}
                bids={bids}
                mutation={finalizeMutation}
                onNext={goToNextStep}
              />,
              <SingleBuybackReviewSection
                key="single-buyback-review"
                buyback={buyback}
                bids={bids}
                mutation={finalizeMutation}
                onBack={goToPreviousStep}
              />,
            ]
          : [
              <ConfirmationSection key="confirmation" buyback={buyback} bids={bids} onNext={goToNextStep} />,
              <ReviewInvestorsSection
                key="review-investors"
                onNext={goToNextStep}
                onBack={goToPreviousStep}
                bids={bids}
              />,
              <SubmitSection
                key="submit"
                onBack={goToPreviousStep}
                buyback={buyback}
                bids={bids}
                mutation={finalizeMutation}
              />,
            ]}
      </DialogStackContent>
    </Dialog>
  );
};

const ConfirmationSection = ({ buyback, bids, onNext }: ConfirmationSectionProps) => {
  const company = useCurrentCompany();
  const acceptedBids = bids.filter((bid) => Number(bid.accepted_shares) > 0);
  const totalAcceptedShares = acceptedBids.reduce((sum, bid) => sum + Number(bid.accepted_shares), 0);

  const clearingPrice = buyback.accepted_price_cents || 0;

  const totalPayout = totalAcceptedShares * clearingPrice;

  const impliedValuation = company.fullyDilutedShares ? Number(company.fullyDilutedShares) * clearingPrice : 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Tender offer summary</DialogTitle>
        <DialogDescription>Review the buyback details before finalizing the settlement.</DialogDescription>
      </DialogHeader>

      <div className="space-y-0">
        <div className="flex justify-between border-b border-gray-200 pb-4">
          <span className="font-medium">Buyback name</span>
          <span>{buyback.name}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">Accepted investors</span>
          <span>{buyback.investor_count}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">Implied valuation</span>
          <span>{formatMoneyFromCents(impliedValuation)}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">Clearing price per share</span>
          <span>{formatMoneyFromCents(clearingPrice)}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">Accepted shares</span>
          <span>{totalAcceptedShares.toLocaleString()}</span>
        </div>

        <div className="flex justify-between py-4">
          <span className="font-medium">Total Payout</span>
          <span className="font-bold">{formatMoneyFromCents(totalPayout)}</span>
        </div>
      </div>

      <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0">
        <Button onClick={onNext} className="w-full sm:w-auto">
          Continue
        </Button>
      </DialogFooter>
    </>
  );
};

const ReviewInvestorsSection = ({ onNext, onBack, bids }: ReviewInvestorsSectionProps) => {
  const acceptedBids = bids.filter((bid) => Number(bid.accepted_shares) > 0);
  const totalShares = acceptedBids.reduce((sum, bid) => sum + Number(bid.accepted_shares), 0);
  const totalPayout = acceptedBids.reduce((sum, bid) => sum + Number(bid.accepted_shares) * bid.share_price_cents, 0);

  const handleDownloadCSV = () => {
    const csvHeader = "Investor,Shares,Total\n";
    const csvRows = acceptedBids
      .map(
        (bid) =>
          `"${bid.investor.name}",${Number(bid.accepted_shares)},"${formatMoneyFromCents(Number(bid.accepted_shares) * bid.share_price_cents)}"`,
      )
      .join("\n");

    download("text/csv", "InvestorBids.csv", csvHeader + csvRows);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Review investors</DialogTitle>
        <DialogDescription>
          Please review the list of investors and verify all information is correct before proceeding with settlement.
        </DialogDescription>
      </DialogHeader>

      <div className="mb-4 flex items-center justify-between">
        <span className="font-medium">{acceptedBids.length} investors</span>
        <Button variant="outline" size="small" onClick={handleDownloadCSV} disabled={acceptedBids.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      <div>
        <div className="max-h-64 overflow-y-auto">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-4 pb-2 text-sm font-medium text-gray-600">
              <span>Investor</span>
              <span className="text-right">Shares</span>
              <span className="text-right">Total</span>
            </div>

            {acceptedBids.length > 0 ? (
              acceptedBids.map((bid) => (
                <div key={bid.id} className="grid grid-cols-3 gap-4 border-t border-gray-200 px-2 py-3 text-sm">
                  <span className="font-medium">{bid.investor.name}</span>
                  <span className="text-right">{Number(bid.accepted_shares).toLocaleString()}</span>
                  <span className="text-right">
                    {formatMoneyFromCents(Number(bid.accepted_shares) * bid.share_price_cents)}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-gray-500">No accepted bids found</div>
            )}
          </div>
        </div>

        {acceptedBids.length > 0 ? (
          <div className="grid grid-cols-3 gap-4 border-t border-gray-200 bg-gray-50 px-2 py-3 text-sm font-bold">
            <span>Total payout</span>
            <span className="text-right">{totalShares.toLocaleString()}</span>
            <span className="text-right">{formatMoneyFromCents(totalPayout)}</span>
          </div>
        ) : null}
      </div>

      <DialogFooter className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <Button onClick={onNext} disabled={acceptedBids.length === 0} className="w-full sm:w-24">
          Continue
        </Button>
      </DialogFooter>
    </>
  );
};

const SubmitSection = ({ onBack, buyback, bids, mutation }: SubmitSectionProps) => {
  const [confirmed, setConfirmed] = useState(false);

  const acceptedBids = bids.filter((bid) => Number(bid.accepted_shares) > 0);
  const totalShares = acceptedBids.reduce((sum, bid) => sum + Number(bid.accepted_shares), 0);

  const clearingPrice = buyback.accepted_price_cents || 0;

  const totalPayout = totalShares * clearingPrice;

  const handleFinalize = () => {
    if (confirmed) {
      mutation.mutate(undefined);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirm and process payment</DialogTitle>
        <DialogDescription>
          Please confirm all details are accurate. Payments will be issued and the buyback finalized once you hit next.
        </DialogDescription>
      </DialogHeader>

      <div>
        <div className="flex justify-between pb-4">
          <span className="font-medium">Accepted investors</span>
          <span>{buyback.investor_count}</span>
        </div>

        <div className="flex justify-between border-t border-gray-200 py-4">
          <span className="font-medium">Clearing price per share</span>
          <span>{formatMoneyFromCents(clearingPrice)}</span>
        </div>

        <div className="flex justify-between border-t border-gray-200 py-4">
          <span className="font-medium">Accepted shares</span>
          <span>{totalShares.toLocaleString()}</span>
        </div>

        <div className="flex justify-between border-t border-gray-200 pt-4">
          <span className="font-medium">Total payout</span>
          <span className="font-bold">{formatMoneyFromCents(totalPayout)}</span>
        </div>
      </div>

      <div className="mt-6 flex items-center space-x-2">
        <Checkbox
          id="confirm-details"
          checked={confirmed}
          onCheckedChange={() => setConfirmed(!confirmed)}
          className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
        />
        <label htmlFor="confirm-details" className="text-sm">
          I've reviewed all information and confirm it's correct.
        </label>
      </div>

      <DialogFooter className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <MutationStatusButton
          onClick={handleFinalize}
          mutation={mutation}
          disabled={!confirmed}
          className="w-full sm:w-auto"
        >
          Finalize buyback
        </MutationStatusButton>
      </DialogFooter>
    </>
  );
};

const SingleBuybackConfirmationSection = ({ buyback, bids, onNext }: SingleBuybackConfirmationSectionProps) => {
  const acceptedBids = bids.filter((bid) => Number(bid.accepted_shares) > 0);
  const totalAcceptedShares = acceptedBids.reduce((sum, bid) => sum + Number(bid.accepted_shares), 0);
  const clearingPrice = buyback.accepted_price_cents || 0;

  if (!acceptedBids[0]) {
    return null;
  }

  const investor = acceptedBids[0].investor;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Single stock repurchase summary</DialogTitle>
        <DialogDescription>
          You're repurchasing shares directly from this investor. Please confirm the payout and share details before
          proceeding.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-0">
        <div className="flex justify-between border-b border-gray-200 pb-4">
          <span className="font-medium">Buyback name</span>
          <span>{buyback.name}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">Investor</span>
          <span>{investor.name}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">Price per share</span>
          <span>{formatMoneyFromCents(clearingPrice)}</span>
        </div>

        <div className="flex justify-between py-4">
          <span className="font-medium">Allocation limit</span>
          <span>{totalAcceptedShares.toLocaleString()}</span>
        </div>
      </div>

      <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0">
        <Button onClick={onNext} className="w-full sm:w-auto">
          Continue
        </Button>
      </DialogFooter>
    </>
  );
};

const SingleBuybackReviewSection = ({ buyback, bids, mutation, onBack }: SingleBuybackReviewSectionProps) => {
  const [confirmed, setConfirmed] = useState(false);

  const acceptedBids = bids.filter((bid) => Number(bid.accepted_shares) > 0);
  const clearingPrice = buyback.accepted_price_cents || 0;

  // Group bids by share class
  const bidsByShareClass = acceptedBids.reduce<Record<string, { shares: number; total: number }>>((acc, bid) => {
    const shareClass = bid.share_class;
    if (!acc[shareClass]) {
      acc[shareClass] = { shares: 0, total: 0 };
    }
    acc[shareClass].shares += Number(bid.accepted_shares);
    acc[shareClass].total += Number(bid.accepted_shares) * clearingPrice;
    return acc;
  }, {});

  const totalShares = Object.values(bidsByShareClass).reduce((sum, item) => sum + item.shares, 0);
  const totalAmount = Object.values(bidsByShareClass).reduce((sum, item) => sum + item.total, 0);

  const handleDownloadCSV = () => {
    const csvData = [
      "Share class,Shares,Total",
      ...Object.entries(bidsByShareClass).map(
        ([shareClass, data]) => `"${shareClass}",${data.shares},"${formatMoneyFromCents(data.total)}"`,
      ),
      `"Total",${totalShares},"${formatMoneyFromCents(totalAmount)}"`,
    ];

    download("text/csv", "InvestorSale.csv", csvData.join("\n"));
  };

  const handleConfirmAndPay = () => {
    if (confirmed) {
      mutation.mutate(undefined);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Review investor's sale</DialogTitle>
        <DialogDescription>
          Confirm that all share sale and payout details are accurate. This action will trigger payment to the investor
          and complete the repurchase.
        </DialogDescription>
      </DialogHeader>

      <div className="mb-4 flex justify-end">
        <Button
          variant="outline"
          size="small"
          onClick={handleDownloadCSV}
          disabled={Object.keys(bidsByShareClass).length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      <div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-4 pb-2 text-sm font-medium text-gray-600">
            <span>Share class</span>
            <span className="text-right">Shares</span>
            <span className="text-right">Total</span>
          </div>

          {Object.keys(bidsByShareClass).length > 0 ? (
            <>
              {Object.entries(bidsByShareClass).map(([shareClass, data]) => (
                <div key={shareClass} className="grid grid-cols-3 gap-4 border-t border-gray-200 px-2 py-3 text-sm">
                  <span className="font-medium">{shareClass}</span>
                  <span className="text-right">{data.shares.toLocaleString()}</span>
                  <span className="text-right">{formatMoneyFromCents(data.total)}</span>
                </div>
              ))}

              <div className="grid grid-cols-3 gap-4 border-t border-gray-200 bg-gray-50 px-2 py-3 text-sm font-bold">
                <span></span>
                <span className="text-right">{totalShares.toLocaleString()}</span>
                <span className="text-right">{formatMoneyFromCents(totalAmount)}</span>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">No accepted bids found</div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center space-x-2">
        <Checkbox
          id="confirm-details"
          checked={confirmed}
          onCheckedChange={() => setConfirmed(!confirmed)}
          className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
        />
        <label htmlFor="confirm-details" className="text-sm">
          I've reviewed all information and confirm it's correct.
        </label>
      </div>

      <DialogFooter className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <MutationStatusButton
          onClick={handleConfirmAndPay}
          mutation={mutation}
          disabled={!confirmed}
          className="w-full sm:w-auto"
        >
          Confirm and pay
        </MutationStatusButton>
      </DialogFooter>
    </>
  );
};

export default FinalizeBuybackModal;
