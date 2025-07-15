import React from "react";
import type { Buyback, BuybackBid } from "@/app/equity/buybacks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany } from "@/global";
import { formatMoneyFromCents } from "@/utils/formatMoney";

type FinalizeBuybackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  buyback: Buyback;
  bids: BuybackBid[];
};

const FinalizeBuybackModal = ({ isOpen, onClose, onNext, buyback, bids }: FinalizeBuybackModalProps) => {
  const company = useCurrentCompany();
  const acceptedBids = bids.filter((bid) => Number(bid.accepted_shares) > 0);
  const totalAcceptedShares = acceptedBids.reduce((sum, bid) => sum + Number(bid.accepted_shares), 0);

  const clearingPrice = buyback.accepted_price_cents || 0;

  const totalPayout = totalAcceptedShares * clearingPrice;

  const impliedValuation = company.fullyDilutedShares ? Number(company.fullyDilutedShares) * clearingPrice : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tender offer summary</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm">Review the buyback details before finalizing the settlement.</p>

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
            {/* TODO is this correct? */}
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
      </DialogContent>
    </Dialog>
  );
};

export default FinalizeBuybackModal;
