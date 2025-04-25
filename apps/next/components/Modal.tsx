import { XMarkIcon } from "@heroicons/react/24/solid";
import React from "react";
import { cn } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  sticky?: boolean;
  sidebar?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

const Modal = ({ open, onClose, title, sticky, sidebar, children, footer, className }: ModalProps) => {
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "w-max max-w-prose min-w-80 gap-4 p-0 overflow-visible",
          sidebar ? "ml-auto min-h-screen md:mr-0" : "",
          className,
        )}
        onInteractOutside={(e) => {
          if (sticky) e.preventDefault();
        }}
      >
        <div className="flex w-full flex-col gap-4 p-5">
          {title ? (
            <DialogHeader className="flex flex-row items-center justify-between gap-4">
              <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
              {!sticky && (
                <DialogClose className="hover:text-blue-600">
                  <XMarkIcon className="size-6" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              )}
            </DialogHeader>
          ) : null}
          <div className="flex grow flex-col gap-4 overflow-y-auto">{children}</div>
          {footer ? <div className="grid auto-cols-fr grid-flow-col items-center gap-3">{footer}</div> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Modal;
