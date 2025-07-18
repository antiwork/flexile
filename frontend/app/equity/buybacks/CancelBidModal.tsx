import { useMutation } from "@tanstack/react-query";
import type { Buyback, BuybackBid } from "@/app/equity/buybacks";
import MutationButton from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany } from "@/global";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_tender_offer_bid_path } from "@/utils/routes";

type CancelBidModalProps = {
  isOpen: boolean;
  onClose: () => void;
  bid: BuybackBid | null;
  buyback: Buyback;
};

const CancelBidModal = ({ isOpen, onClose, bid, buyback }: CancelBidModalProps) => {
  const company = useCurrentCompany();
  const destroyMutation = useMutation({
    mutationFn: async ({ bidId }: { bidId: string }) => {
      await request({
        method: "DELETE",
        url: company_tender_offer_bid_path(company.id, buyback.id, bidId),
        accept: "json",
        assertOk: true,
      });
    },
    onSuccess: () => {
      onClose();
    },
  });

  if (!bid) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel bid?</DialogTitle>
        </DialogHeader>
        <p>Are you sure you want to cancel this bid?</p>
        <p>
          Share class: {bid.share_class}
          <br />
          Number of shares: {bid.number_of_shares.toLocaleString()}
          <br />
          BuybackBid price: {formatMoneyFromCents(bid.share_price_cents)}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            No, keep bid
          </Button>
          <MutationButton mutation={destroyMutation} param={{ bidId: bid.id }} loadingText="Canceling...">
            Yes, cancel bid
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelBidModal;
