import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils";

function Switch({
  label,
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { label?: React.ReactNode }) {
  return (
    <Label className="has-invalid:text-red relative flex cursor-pointer items-center gap-2">
      <SwitchPrimitive.Root
        data-slot="switch"
        className={cn(
          "peer dark:data-[state=unchecked]:bg-input/80 invalid:border-red checked:invalid:bg-red data-[state=unchecked]:bg-input focus-visible:ring-ring/15 pointer-events-none inline-flex h-5 w-8 shrink-0 items-center rounded-full px-1 transition-all outline-none focus-visible:border-gray-300 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blue-600",
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className={cn(
            "pointer-events-none block size-3.5 rounded-full bg-white ring-0 transition-transform data-[state=checked]:translate-x-[10px] data-[state=unchecked]:translate-x-0",
          )}
        />
      </SwitchPrimitive.Root>
      {label ? <div className="grow">{label}</div> : null}
    </Label>
  );
}

export { Switch };
