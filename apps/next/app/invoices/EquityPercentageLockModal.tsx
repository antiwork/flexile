import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
        <DialogTitle>Lock {percentage}% in equity for all {year}?</DialogTitle>
      </DialogHeader>
      <p>
        By submitting this invoice, your current equity selection of {percentage}% will be locked for all {year}.{" "}
        <strong>You won't be able to choose a different allocation until the next options grant for {year + 1}.</strong>
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/settings/equity">Change selection</Link>
        </Button>
        <Button onClick={onComplete}>Confirm {percentage}% equity selection</Button>
      </div>
    </DialogContent>
  </Dialog>
);

export default EquityPercentageLockModal;
