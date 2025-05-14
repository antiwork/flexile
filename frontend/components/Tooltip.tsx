import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = TooltipPrimitive.Root;

export const TooltipTrigger = ({ asChild, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) => (
  <TooltipPrimitive.Trigger {...props} asChild>
    {asChild ? props.children : <div tabIndex={0}>{props.children}</div>}
  </TooltipPrimitive.Trigger>
);

export const TooltipPortal = TooltipPrimitive.Portal;

export const TooltipContent = ({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) => {
  if (!children) return null;

  return (
    <TooltipPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        "pointer-events-none z-10 w-40 max-w-max rounded-md bg-black p-2 text-sm text-wrap text-white",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow />
    </TooltipPrimitive.Content>
  );
};
