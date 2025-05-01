import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
}) => (
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
        <Button onClick={onComplete}>Confirm {percentage}% equity selection</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default EquityPercentageLockModal;
