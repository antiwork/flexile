import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/utils";
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}
function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}
function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80",
        className,
      )}
      {...props}
    />
  );
}
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex max-h-[95vh] min-h-0 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 overflow-y-auto rounded-lg p-8 shadow-lg duration-200 sm:max-w-lg md:max-h-[85vh]",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-[26px] right-5 mt-2 mr-2 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2 text-left", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-base", className)} {...props} />
  );
}

type LayerConfig = {
  scaleX: number;
  offsetY: number;
};

type DialogStackContentProps = {
  step: number;
  children: React.ReactNode;
} & React.ComponentProps<typeof DialogPrimitive.Content>;

function DialogStackContent({ step, children, className, ...props }: DialogStackContentProps) {
  const childrenArray = React.Children.toArray(children);
  const totalSteps = childrenArray.length;

  // Generate stack layers dynamically based on totalSteps
  // Last layer: { scaleX: BASE_SCALE, offsetY: BASE_OFFSET }
  // Each previous layer: reduce scaleX by SCALE_STEP, increase offsetY by OFFSET_STEP
  const BASE_SCALE = 0.95;
  const SCALE_STEP = 0.05;
  const BASE_OFFSET = 20;
  const OFFSET_STEP = 20;
  const stackLayers: LayerConfig[] = Array.from({ length: totalSteps - 1 }, (_, i) => ({
    scaleX: BASE_SCALE - (totalSteps - 2 - i) * SCALE_STEP,
    offsetY: BASE_OFFSET + (totalSteps - 2 - i) * OFFSET_STEP,
  }));

  const layersToShow = stackLayers.slice(step);

  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className="fixed inset-0 z-40 overflow-auto bg-black/80">
        <div className="mt-16 mb-10 flex w-full justify-center px-4">
          <div className="relative w-full max-w-lg">
            {layersToShow.map((layer, i) => (
              <div
                key={i}
                className={cn(
                  "bg-background absolute inset-0 rounded-lg shadow-[0_6px_24px_rgba(0,0,0,0.10),_0_9px_48px_rgba(0,0,0,0.08)] transition-transform duration-300",
                )}
                style={{
                  transform: `translateY(-${layer.offsetY}px) scaleX(${layer.scaleX})`,
                  zIndex: 10 + i,
                }}
              />
            ))}

            <DialogPrimitive.Content
              data-slot="dialog-content"
              className={cn(
                "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative z-50 w-full content-start rounded-lg p-8 shadow-[0_6px_24px_rgba(0,0,0,0.10),_0_9px_48px_rgba(0,0,0,0.08)] duration-200",
                className,
              )}
              {...props}
            >
              {childrenArray.map((child, index) => (
                <div
                  key={index}
                  className={cn("grid gap-4", index === step ? "grid" : "hidden")}
                  data-slot="dialog-section"
                >
                  {child}
                </div>
              ))}
              <DialogPrimitive.Close
                data-slot="dialog-close"
                className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </DialogPrimitive.Content>
          </div>
        </div>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
}
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogStackContent,
  DialogTitle,
  DialogTrigger,
};
