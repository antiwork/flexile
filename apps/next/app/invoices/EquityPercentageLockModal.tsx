import Link from "next/link";
import Modal from "@/components/Modal";
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
  <Modal open={open} onClose={onClose} title={`Lock ${percentage}% in equity for all ${year}?`}>
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
  </Modal>
);

export default EquityPercentageLockModal;
