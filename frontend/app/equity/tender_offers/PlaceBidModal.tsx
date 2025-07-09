import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatServerDate } from "@/utils/time";
import LetterOfTransmittalModal from "./LetterOfTransmittalModal";
import PlaceBidFormModal from "./PlaceBidFormModal";
import { Download } from "lucide-react";

type TenderOffer = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  minimumValuation: bigint;
  startingPrice: bigint;
  attachment:
    | {
        key: string;
        filename: string;
      }
    | undefined;
};

type PlaceBidModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tenderOffer: TenderOffer | null;
};

type ModalStep = "details" | "letter" | "form";

const PlaceBidModal = ({ isOpen, onClose, tenderOffer }: PlaceBidModalProps) => {
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

  if (!tenderOffer) {
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
              <span>{formatServerDate(tenderOffer.startsAt)}</span>
            </div>

            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">End date</span>
              <span>{formatServerDate(tenderOffer.endsAt)}</span>
            </div>

            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">Starting valuation</span>
              <span>{formatMoney(tenderOffer.minimumValuation)}</span>
            </div>

            <div className="flex justify-between border-b border-gray-200 py-4">
              <span className="font-medium">Starting price per share</span>
              <span>{formatMoneyFromCents(tenderOffer.startingPrice)}</span>
            </div>

            {tenderOffer.attachment ? (
              <div className="flex justify-between border-b border-gray-200 py-4">
                <span className="font-medium">Buyback documents</span>
                <Button asChild variant="outline" size="small">
                  <Link href={`/download/${tenderOffer.attachment.key}/${tenderOffer.attachment.filename}`}>
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
      />

      <PlaceBidFormModal
        isOpen={currentStep === "form"}
        onClose={handleClose}
        onBack={handleFormBack}
        tenderOffer={tenderOffer}
      />
    </>
  );
};

export default PlaceBidModal;
