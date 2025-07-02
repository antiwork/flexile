import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrentUser } from "@/global";
import LetterOfTransmissal from "./[id]/LetterOfTransmissal";

type LetterOfTransmittalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
};

const LetterOfTransmittalModal = ({ isOpen, onClose, onBack, onNext }: LetterOfTransmittalModalProps) => {
  const user = useCurrentUser();
  const [hasReviewed, setHasReviewed] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [showDocument, setShowDocument] = useState(false);

  const handleContinue = () => {
    if (hasReviewed && hasSigned) {
      onNext();
    }
  };

  const handleReviewedChange = (checked: boolean) => {
    setHasReviewed(checked);
  };

  const canContinue = hasReviewed && hasSigned;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-lg flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Letter of transmittal</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <p className="mb-4 shrink-0 text-sm">
            Review and sign the Letter of Transmittal to confirm your participation in this buyback.
          </p>

          {showDocument ? (
            <div className="mb-4 min-h-0 flex-1">
              <div className="h-full max-h-80 overflow-y-auto rounded-md border p-4">
                <div className="prose prose-sm max-w-none">
                  <LetterOfTransmissal />
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-auto grid shrink-0 gap-4 pt-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="reviewed"
                checked={hasReviewed}
                onCheckedChange={handleReviewedChange}
                className="shrink-0"
              />
              <label htmlFor="reviewed" className="cursor-pointer text-sm leading-tight font-medium">
                I've reviewed the{" "}
                <span
                  className="text-blue-600 underline hover:text-blue-800"
                  onClick={() => setShowDocument(!showDocument)}
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
      </DialogContent>
    </Dialog>
  );
};

export default LetterOfTransmittalModal;
