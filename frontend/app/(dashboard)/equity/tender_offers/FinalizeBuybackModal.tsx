import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { Download } from "lucide-react";
import React, { useState } from "react";
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
import type { RouterOutput } from "@/trpc";
import { download } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatNumber } from "@/utils/numbers";
import { request } from "@/utils/request";

type TenderOffer = RouterOutput["tenderOffers"]["get"];
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

type FinalizeBuybackModalProps = {
  onClose: () => void;
  data: TenderOffer;
  bids: Bid[];
};

type ConfirmationSectionProps = {
  data: TenderOffer;
  bids: Bid[];
  onNext: () => void;
};

type ReviewInvestorsSectionProps = {
  onNext: () => void;
  onBack: () => void;
  data: TenderOffer;
  bids: Bid[];
};

type SubmitSectionProps = {
  onBack: () => void;
  data: TenderOffer;
  bids: Bid[];
  mutation: UseMutationResult<unknown, unknown, void>;
};

const FinalizeBuybackModal = ({ onClose, data, bids }: FinalizeBuybackModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const company = useCurrentCompany();

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      await request({
        method: "POST",
        url: finalize_company_tender_offer_path(company.id, data.id),
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
        {[
          <ConfirmationSection key="confirmation" data={data} bids={bids} onNext={goToNextStep} />,
          <ReviewInvestorsSection
            key="review-investors"
            data={data}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
            bids={bids}
          />,
          <SubmitSection key="submit" onBack={goToPreviousStep} data={data} bids={bids} mutation={finalizeMutation} />,
        ]}
      </DialogStackContent>
    </Dialog>
  );
};

const ConfirmationSection = ({ data, bids, onNext }: ConfirmationSectionProps) => {
  const company = useCurrentCompany();
  const acceptedBids = bids.filter((bid) => new Decimal(bid.acceptedShares).gt(0));
  const totalAcceptedShares = acceptedBids.reduce((sum, bid) => sum.plus(bid.acceptedShares), new Decimal(0));

  const clearingPrice = data.acceptedPriceCents || 0;
  const totalPayout = totalAcceptedShares.mul(clearingPrice);

  const impliedValuation = company.fullyDilutedShares ? Number(company.fullyDilutedShares) * clearingPrice : 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Tender offer summary</DialogTitle>
        <DialogDescription>Review the buyback details before finalizing the settlement.</DialogDescription>
      </DialogHeader>

      <div className="space-y-0">
        <div className="flex justify-between border-b border-gray-200 pb-4">
          <span className="font-medium">Buyback Name</span>
          <span>{data.name}</span>
        </div>

        <div className="flex justify-between border-b border-gray-200 py-4">
          <span className="font-medium">Accepted investors</span>
          <span>{data.investorCount}</span>
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
          <span>{formatNumber(totalAcceptedShares)}</span>
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

const ReviewInvestorsSection = ({ onNext, onBack, data, bids }: ReviewInvestorsSectionProps) => {
  const acceptedBids = bids.filter((bid) => new Decimal(bid.acceptedShares).gt(0));
  const totalAcceptedShares = acceptedBids.reduce((sum, bid) => sum.plus(bid.acceptedShares), new Decimal(0));
  const clearingPrice = data.acceptedPriceCents || 0;
  const totalPayout = totalAcceptedShares.mul(clearingPrice);

  const handleDownloadCSV = () => {
    const csvHeader = "Investor,Shares,Total\n";
    const csvRows = acceptedBids
      .map(
        (bid) =>
          `"${bid.companyInvestor.user.name}",${bid.acceptedShares},"${new Decimal(bid.acceptedShares).mul(data.acceptedPriceCents || 0).toString()}"`,
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
        <span className="font-medium">
          {acceptedBids.length} investor{acceptedBids.length > 1 ? "s" : ""}
        </span>
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
                  <span className="font-medium">{bid.companyInvestor.user.name}</span>
                  <span className="text-right">{formatNumber(bid.acceptedShares)}</span>
                  <span className="text-right">
                    {formatMoneyFromCents(new Decimal(bid.acceptedShares).mul(data.acceptedPriceCents || 0))}
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
            <span className="text-right">{formatNumber(totalAcceptedShares)}</span>
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

const SubmitSection = ({ onBack, data, bids, mutation }: SubmitSectionProps) => {
  const [confirmed, setConfirmed] = useState(false);

  const acceptedBids = bids.filter((bid) => new Decimal(bid.acceptedShares).gt(0));
  const totalShares = acceptedBids.reduce((sum, bid) => sum.plus(bid.acceptedShares), new Decimal(0));

  const clearingPrice = data.acceptedPriceCents || 0;

  const totalPayout = totalShares.mul(clearingPrice);

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
          <span>{data.investorCount}</span>
        </div>

        <div className="flex justify-between border-t border-gray-200 py-4">
          <span className="font-medium">Clearing price per share</span>
          <span>{formatMoneyFromCents(clearingPrice)}</span>
        </div>

        <div className="flex justify-between border-t border-gray-200 py-4">
          <span className="font-medium">Accepted shares</span>
          <span>{formatNumber(totalShares)}</span>
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

export default FinalizeBuybackModal;
