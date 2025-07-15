import { Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Buyback } from "@/app/equity/buybacks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatServerDate } from "@/utils/time";
import LetterOfTransmittalModal from "./LetterOfTransmittalModal";
import PlaceBidFormModal from "./PlaceBidFormModal";

type PlaceBidModalProps = {
  isOpen: boolean;
  onClose: () => void;
  buyback: Buyback | null;
};

type ModalStep = "details" | "letter" | "form";

const PlaceBidModal = ({ isOpen, onClose, buyback }: PlaceBidModalProps) => {
  const [currentStep, setCurrentStep] = useState<ModalStep>("details");

  const handleContinueFromDetails = () => {
    setCurrentStep("letter");
  };

  const handleLetterBack = () => {
    setCurrentStep("details");
  };

  const handleLetterContinue = () => {
    setCurrentStep("form");
  };

  const handleFormBack = () => {
    setCurrentStep("letter");
  };

  const handleClose = () => {
    setCurrentStep("details");
    onClose();
  };

  if (!buyback) {
    return null;
  }

  return (
    <>
      <Dialog open={Boolean(isOpen && currentStep === "details")} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buyback details</DialogTitle>
          </DialogHeader>

          <p className="mb-4 text-sm">Review the buyback terms below and continue to confirm your participation.</p>

          <div className="space-y-0">
            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">Start date</span>
              <span>{formatServerDate(buyback.starts_at)}</span>
            </div>

            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">End date</span>
              <span>{formatServerDate(buyback.ends_at)}</span>
            </div>

            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">Starting valuation</span>
              <span>{formatMoney(buyback.minimum_valuation)}</span>
            </div>

            {buyback.starting_price_per_share_cents ? (
              <div className="flex justify-between border-b border-gray-200 py-4">
                <span className="font-medium">Starting price per share</span>
                <span>{formatMoneyFromCents(buyback.starting_price_per_share_cents)}</span>
              </div>
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

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0">
            <Button onClick={handleContinueFromDetails} className="w-full sm:w-auto">
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LetterOfTransmittalModal
        isOpen={currentStep === "letter"}
        onClose={handleClose}
        onBack={handleLetterBack}
        onNext={handleLetterContinue}
        buyback={buyback}
      />

      <PlaceBidFormModal
        isOpen={currentStep === "form"}
        onClose={handleClose}
        onBack={handleFormBack}
        buyback={buyback}
      />
    </>
  );
};

export default PlaceBidModal;
