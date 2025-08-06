"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import { Minus } from "lucide-react";
import * as React from "react";
import { cn } from "../../utils";

const InputOTP = React.forwardRef<React.ElementRef<typeof OTPInput>, React.ComponentPropsWithoutRef<typeof OTPInput>>(
  ({ className, containerClassName, ...props }, ref) => (
    <OTPInput
      ref={ref}
      data-slot="input-otp"
      containerClassName={cn("flex items-center gap-2 has-[:disabled]:opacity-50", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  ),
);
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex items-center", className)} {...props} />,
);
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const slot = inputOTPContext.slots[index];
  const { char, hasFakeCaret, isActive } = slot || { char: null, hasFakeCaret: false, isActive: false };

  return (
    <div
      ref={ref}
      data-input-otp-slot={index}
      className={cn(
        "border-input relative flex h-10 w-10 items-center justify-center border-y border-r text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "ring-ring ring-offset-background z-10 ring-2",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      ) : null}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<React.ElementRef<"div">, React.ComponentPropsWithoutRef<"div">>(
  ({ ...props }, ref) => (
    <div ref={ref} role="separator" {...props}>
      <Minus />
    </div>
  ),
);
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
