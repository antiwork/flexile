import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import type { RouterOutput } from "@/trpc";

type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

type ReviewInvestorsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onBack: () => void;
  bids: Bid[];
};

const ReviewInvestorsModal = ({ isOpen, onClose, onNext, onBack, bids }: ReviewInvestorsModalProps) => {
  const acceptedBids = bids.filter((bid) => Number(bid.acceptedShares) > 0);
  const totalShares = acceptedBids.reduce((sum, bid) => sum + Number(bid.acceptedShares), 0);
  const totalPayout = acceptedBids.reduce((sum, bid) => sum + Number(bid.acceptedShares) * bid.sharePriceCents, 0);

  const handleDownloadCSV = () => {
    try {
      const csvHeader = "Investor,Shares,Total\n";
      const csvRows = acceptedBids
        .map(
          (bid) =>
            `"${bid.companyInvestor.user.name}",${Number(bid.acceptedShares)},"${formatMoneyFromCents(Number(bid.acceptedShares) * bid.sharePriceCents)}"`,
        )
        .join("\n");

      const csvContent = csvHeader + csvRows;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "investor-bids.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download CSV:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review investors</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm text-gray-600">
          Please review the list of investors and verify all information is correct before proceeding with settlement.
        </p>

        <div className="mb-4 flex items-center justify-between">
          <span className="font-medium">{acceptedBids.length} investors</span>
          <Button variant="outline" size="small" onClick={handleDownloadCSV} disabled={acceptedBids.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-4 border-b pb-2 text-sm font-medium text-gray-600">
              <span>Investor</span>
              <span>Shares</span>
              <span>Total</span>
            </div>

            {acceptedBids.length > 0 ? (
              acceptedBids.map((bid) => (
                <div key={bid.id} className="grid grid-cols-3 gap-4 py-2 text-sm">
                  <span className="font-medium">{bid.companyInvestor.user.name}</span>
                  <span>{Number(bid.acceptedShares).toLocaleString()}</span>
                  <span>{formatMoneyFromCents(Number(bid.acceptedShares) * bid.sharePriceCents)}</span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-gray-500">No accepted bids found</div>
            )}

            {acceptedBids.length > 0 ? (
              <div className="grid grid-cols-3 gap-4 border-t pt-2 text-sm font-bold">
                <span>Total payout</span>
                <span>{totalShares.toLocaleString()}</span>
                <span>{formatMoneyFromCents(totalPayout)}</span>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
            Back
          </Button>
          <Button onClick={onNext} disabled={acceptedBids.length === 0} className="w-full sm:w-auto">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewInvestorsModal;
