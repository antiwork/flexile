import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";

type TenderOffer = RouterOutput["tenderOffers"]["get"];
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

type FinalizeBuybackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  tenderOffer: TenderOffer;
  bids: Bid[];
};

const FinalizeBuybackModal = ({ isOpen, onClose, onNext, tenderOffer, bids }: FinalizeBuybackModalProps) => {
  const company = useCurrentCompany();
  const acceptedBids = bids.filter((bid) => Number(bid.acceptedShares) > 0);
  const totalAcceptedShares = acceptedBids.reduce((sum, bid) => sum + Number(bid.acceptedShares), 0);

  const clearingPrice = tenderOffer.acceptedPriceCents || 0;

  const totalPayout = totalAcceptedShares * clearingPrice;

  const impliedValuation = company.fullyDilutedShares ? Number(company.fullyDilutedShares) * clearingPrice : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tender offer summary</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm text-gray-600">Review the buyback details before finalizing the settlement.</p>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="font-medium">Buyback name</span>
            <span>{tenderOffer.name || "Q2 2025 Buyback"}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium">Accepted investors</span>
            <span>{acceptedBids.length}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium">Implied valuation</span>
            <span>{formatMoneyFromCents(impliedValuation)}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium">Clearing price per share</span>
            <span>{formatMoneyFromCents(clearingPrice)}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium">Accepted shares</span>
            <span>{totalAcceptedShares.toLocaleString()}</span>
          </div>

          <div className="flex justify-between border-t pt-4">
            <span className="font-medium">Total Payout</span>
            <span className="font-bold">{formatMoneyFromCents(totalPayout)}</span>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={onNext} className="w-full sm:w-auto">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FinalizeBuybackModal;
