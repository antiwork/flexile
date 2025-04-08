import * as SwitchPrimitives from "@radix-ui/react-switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils";
import * as React from "react";

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & { label?: React.ReactNode }
>(({ className, label, ...props }, ref) => {
  const id = React.useId();

  return (
    <div className="inline-flex items-center gap-2">
      <SwitchPrimitives.Root
        id={`${id}-switch`}
        className={cn(
          "peer focus-visible:ring-ring focus-visible:ring-offset-background inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-black transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600",
          className,
        )}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "bg-background pointer-events-none block h-4 w-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[19px] data-[state=unchecked]:translate-x-[3px] data-[state=unchecked]:bg-black",
          )}
        />
      </SwitchPrimitives.Root>
      {!!label && (
        <Label htmlFor={`${id}-switch`} className="cursor-pointer">
          {label}
        </Label>
      )}
    </div>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
