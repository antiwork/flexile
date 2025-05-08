import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import MutationButton from "@/components/MutationButton";
import { useCurrentCompany } from "@/global";

const EquityPercentageLockModal = ({
  open,
  onClose,
  percentage,
  year,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  percentage: number;
  year: number;
  onComplete: () => void;
}) => {
  const company = useCurrentCompany();
  const equityPercentageMutation = trpc.equitySettings.update.useMutation({ onSuccess: onComplete });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Lock {percentage}% in equity for all {year}?
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          By submitting this invoice, your current equity selection of {percentage}% will be locked for all {year}. You
          won&apos;t be able to choose a different allocation until the next options grant for {year + 1}.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <MutationButton
            mutation={equityPercentageMutation}
            param={{
              companyId: company.id,
              equityPercentage: percentage,
              year,
            }}
          >
            Confirm {percentage}% equity selection
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EquityPercentageLockModal;
