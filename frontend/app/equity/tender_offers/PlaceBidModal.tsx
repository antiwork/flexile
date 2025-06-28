import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/utils/formatMoney";
import { formatServerDate } from "@/utils/time";
import LetterOfTransmittalModal from "./LetterOfTransmittalModal";
import PlaceBidFormModal from "./PlaceBidFormModal";

type TenderOffer = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  minimumValuation: bigint;
  attachment?: {
    key: string;
    filename: string;
  };
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
          <p className="mb-4 text-sm text-gray-600">
            Review the buyback terms below and continue to confirm your participation.
          </p>

          <div className="grid gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-500">Start date</Label>
              <p className="text-sm">{formatServerDate(tenderOffer.startsAt)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">End date</Label>
              <p className="text-sm">{formatServerDate(tenderOffer.endsAt)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Starting valuation</Label>
              <p className="text-sm font-medium">{formatMoney(tenderOffer.minimumValuation)}</p>
            </div>
            {tenderOffer.attachment ? (
              <div>
                <Label className="text-sm font-medium text-gray-500">Buyback documents</Label>
                <Button asChild variant="outline" size="small" className="mt-1 h-auto justify-start px-3 py-2">
                  <Link href={`/download/${tenderOffer.attachment.key}/${tenderOffer.attachment.filename}`}>
                    <span className="mr-2">📄</span>
                    Download
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button onClick={handleContinueFromDetails} className="w-full">
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
