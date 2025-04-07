import { XMarkIcon } from "@heroicons/react/24/solid";
import { createPortal } from "react-dom";
import { cn } from "@/utils";
import { useOnGlobalEvent } from "@/utils/useOnGlobalEvent";
import React, { type ComponentPropsWithoutRef, useEffect, useRef } from "react";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  sticky?: boolean | undefined;
  sidebar?: boolean | undefined;
  children: React.ReactNode;
  footer?: React.ReactNode;
} & Omit<ComponentPropsWithoutRef<"dialog">, "open" | "aria-label" | "onClick">;

const Modal = ({ open, onClose, title, sticky, sidebar, children, footer, className, ...props }: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => dialogRef.current?.[open ? "showModal" : "close"](), [open]);
  useOnGlobalEvent("keydown", (event) => {
    if (event.key === "Escape") onClose?.();
  });

  return createPortal(
    <dialog
      {...props}
      ref={dialogRef}
      className={cn(
        "w-max gap-4 overflow-visible border-none accent-blue-600 transition-transform duration-300 backdrop:bg-black/50 backdrop:transition-opacity backdrop:duration-300 open:flex",
        open ? "scale-100 backdrop:opacity-100" : "backdrop:opacity-0 motion-safe:scale-0",
        sidebar ? "ml-auto min-h-screen md:mr-0" : "inset-1/2 -translate-1/2 rounded-2xl",
        className,
      )}
      aria-label={title}
      onClick={(e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex w-full max-w-prose min-w-80 flex-col gap-4 p-5" onClick={(e) => e.stopPropagation()}>
        {title ? (
          <header className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">{title}</h2>
            {!sticky && (
              <button aria-label="Close" onClick={onClose} className="hover:text-blue-600">
                <XMarkIcon className="size-6" />
              </button>
            )}
          </header>
        ) : null}
        <div className="flex grow flex-col gap-4 overflow-y-auto">{children}</div>
        {footer ? <div className="grid auto-cols-fr grid-flow-col items-center gap-3">{footer}</div> : null}
      </div>
    </dialog>,
    document.body,
  );
};

export default Modal;
