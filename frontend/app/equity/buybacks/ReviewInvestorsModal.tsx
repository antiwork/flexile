import { Download } from "lucide-react";
import React from "react";
import type { BuybackBid } from "@/app/equity/buybacks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { download } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";

type ReviewInvestorsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onBack: () => void;
  bids: BuybackBid[];
};

const ReviewInvestorsModal = ({ isOpen, onClose, onNext, onBack, bids }: ReviewInvestorsModalProps) => {
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review investors</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm">
          Please review the list of investors and verify all information is correct before proceeding with settlement.
        </p>

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
      </DialogContent>
    </Dialog>
  );
};

export default ReviewInvestorsModal;
