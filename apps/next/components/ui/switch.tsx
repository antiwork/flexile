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
          "peer focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 invalid:border-red checked:invalid:bg-red pointer-events-none inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-black px-1 shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-white",
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className={cn(
            "bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=checked]:bg-white data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-black",
          )}
        />
      </SwitchPrimitive.Root>
      {label ? <div className="grow">{label}</div> : null}
    </Label>
  );
}

export { Switch };
