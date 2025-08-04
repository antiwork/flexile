import MutationButton from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentCompany } from "@/global";
import type { RouterOutput } from "@/trpc";
import { trpc } from "@/trpc/client";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import { formatNumber } from "@/utils/numbers";

type TenderOffer = RouterOutput["tenderOffers"]["get"];
type Bid = RouterOutput["tenderOffers"]["bids"]["list"][number];

type CancelBidModalProps = {
  onClose: () => void;
  bid: Bid;
  data: TenderOffer;
};

const CancelBidModal = ({ onClose, bid }: CancelBidModalProps) => {
  const company = useCurrentCompany();

  const destroyMutation = trpc.tenderOffers.bids.destroy.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel bid?</DialogTitle>
        </DialogHeader>
        <p>Are you sure you want to cancel this bid?</p>
        <p>
          Share class: {bid.shareClass}
          <br />
          Number of shares: {formatNumber(bid.numberOfShares)}
          <br />
          Bid price: {formatMoneyFromCents(bid.sharePriceCents)}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            No, keep bid
          </Button>
          <MutationButton
            mutation={destroyMutation}
            param={{ id: bid.id, companyId: company.id }}
            loadingText="Canceling..."
          >
            Yes, cancel bid
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelBidModal;
