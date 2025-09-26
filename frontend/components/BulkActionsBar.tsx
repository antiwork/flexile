import { Ban, CircleCheckBig, Download, Share, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AvailableActions } from "@/components/actions/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RouterOutput } from "@/trpc";

type Invoice = RouterOutput["invoices"]["list"][number];
type Document = RouterOutput["documents"]["list"][number];

type BulkActionsBarProps<T> = {
  selectedItems?: T[];
  onClose: () => void;
  availableActions: AvailableActions<T>[];
  onAction: (actionId: string, items: T[]) => void;
};

export const BulkActionsBar = <T extends Invoice | Document>({
  selectedItems = [],
  onClose,
  availableActions,
  onAction,
}: BulkActionsBarProps<T>) => {
  const [visibleItems, setVisibleItems] = useState<T[]>([]);
  const [visibleActions, setVisibleActions] = useState<AvailableActions<T>[]>([]);

  useEffect(() => {
    if (selectedItems.length > 0) {
      setVisibleItems(selectedItems);
      setVisibleActions(availableActions);
    }
  }, [selectedItems, availableActions]);

  const rowsSelected = visibleItems.length;
  const singleItem = rowsSelected === 1 ? visibleItems[0] : undefined;

  const rejectAction = visibleActions.find((action) => action.key === "reject");
  const approveAction = visibleActions.find((action) => action.key === "approve");
  const deleteAction = visibleActions.find((action) => action.key === "delete");
  const downloadAction = visibleActions.find((action) => action.key === "edit");
  const shareAction = visibleActions.find((action) => action.key === "share");
  const signAction = visibleActions.find((action) => action.key === "reviewAndSign");

  return (
    <Dialog open={selectedItems.length > 0} modal={false}>
      <DialogContent
        showCloseButton={false}
        className="border-border fixed right-auto bottom-16 left-1/2 w-auto -translate-x-1/2 transform rounded-xl border p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Selected items</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 p-2">
          <Button
            variant="outline"
            className="border-muted flex h-9 items-center gap-2 rounded-lg border border-dashed text-sm font-medium hover:bg-white"
            onClick={onClose}
          >
            <span className="tabular-nums">{rowsSelected}</span> selected
            <X className="size-4" />
          </Button>
          {rejectAction ? (
            <Button
              variant="outline"
              className="flex h-9 items-center gap-2 text-sm"
              onClick={() => rejectAction.action && onAction(rejectAction.action, visibleItems)}
            >
              <Ban className="size-3.5" strokeWidth={2.5} />
              Reject
            </Button>
          ) : null}
          {approveAction ? (
            <Button
              variant="primary"
              className="flex h-9 items-center gap-2 border-none text-sm"
              onClick={() => approveAction.action && onAction(approveAction.action, visibleItems)}
            >
              <CircleCheckBig className="size-3.5" strokeWidth={2.5} />
              Approve
            </Button>
          ) : null}
          {deleteAction ? (
            <Button
              variant="outline"
              className="flex h-9 items-center"
              onClick={() => deleteAction.action && onAction(deleteAction.action, visibleItems)}
            >
              <Trash2 className="size-3.5" strokeWidth={2.5} />
            </Button>
          ) : null}
          {downloadAction && downloadAction.href && singleItem ? (
            <Button variant="outline" className="flex h-9 items-center gap-2 text-sm" asChild>
              <Link href={{ pathname: downloadAction.href(singleItem) }}>
                <Download className="size-3.5" strokeWidth={2.5} />
                Download
              </Link>
            </Button>
          ) : null}
          {signAction ? (
            <Button
              variant="primary"
              className="flex h-9 items-center gap-2 text-sm"
              onClick={() => signAction.action && onAction(signAction.action, visibleItems)}
            >
              Review and sign
            </Button>
          ) : null}
          {shareAction ? (
            <Button
              variant="outline"
              className="flex h-9 items-center gap-2 text-sm"
              onClick={() => shareAction.action && onAction(shareAction.action, visibleItems)}
            >
              <Share className="size-3.5" strokeWidth={2.5} />
              Share
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
