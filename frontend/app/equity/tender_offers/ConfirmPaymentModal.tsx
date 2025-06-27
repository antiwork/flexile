import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MutationStatusButton } from "@/components/MutationButton";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import type { RouterOutput } from "@/trpc";
import type { UseMutationResult } from "@tanstack/react-query";

type TenderOffer = RouterOutput["tenderOffers"]["get"];
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

type ConfirmPaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  tenderOffer: TenderOffer;
  bids: Bid[];
  mutation: UseMutationResult<unknown, unknown, void>;
};

const ConfirmPaymentModal = ({ isOpen, onClose, onBack, tenderOffer, bids, mutation }: ConfirmPaymentModalProps) => {
  const [confirmed, setConfirmed] = useState(false);

  const acceptedBids = bids.filter((bid) => Number(bid.acceptedShares) > 0);
  const totalShares = acceptedBids.reduce((sum, bid) => sum + Number(bid.acceptedShares), 0);

  const clearingPrice = tenderOffer.acceptedPriceCents || 0;

  const totalPayout = totalShares * clearingPrice;

  const handleFinalize = () => {
    if (confirmed) {
      mutation.mutate(undefined);
    }
  };

  const handleConfirmedChange = (checked: boolean | "indeterminate") => {
    setConfirmed(checked === true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm and process payment</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm text-gray-600">
          Please confirm all details are accurate. Payments will be issued and the buyback finalized once you hit next.
        </p>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="font-medium">Accepted investors</span>
            <span>{acceptedBids.length}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium">Clearing price per share</span>
            <span>{formatMoneyFromCents(clearingPrice)}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium">Accepted shares</span>
            <span>{totalShares.toLocaleString()}</span>
          </div>

          <div className="flex justify-between border-t pt-4">
            <span className="font-medium">Total payout</span>
            <span className="font-bold">{formatMoneyFromCents(totalPayout)}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center space-x-2">
          <Checkbox
            id="confirm-details"
            checked={confirmed}
            onCheckedChange={handleConfirmedChange}
            className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
          />
          <label htmlFor="confirm-details" className="text-sm">
            I've reviewed all information and confirm it's correct.
          </label>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
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
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPaymentModal;
