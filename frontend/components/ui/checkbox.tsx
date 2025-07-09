import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils";

function Checkbox({
  label,
  checked,
  invalid,
  className,
  onCheckedChange,
  ...props
}: Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "checked" | "onCheckedChange"> & {
  label?: React.ReactNode;
  invalid?: boolean;
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean | "indeterminate") => void;
}) {
  const title = invalid && checked !== "indeterminate" ? `Please ${checked ? "uncheck" : "check"} this field.` : "";

  return (
    <Label className={cn("relative flex cursor-pointer items-center gap-2", invalid && "text-red", className)}>
      <CheckboxPrimitive.Root
        data-slot="checkbox"
        checked={checked}
        onCheckedChange={onCheckedChange}
        title={title}
        aria-invalid={invalid}
        className="group peer border-input dark:bg-input/30 aria-invalid:data-[state=checked]:bg-red aria-invalid:data-[state=checked]:border-red aria-invalid:data-[state=indeterminate]:bg-red aria-invalid:data-[state=indeterminate]:border-red data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:data-[state=indeterminate]:bg-primary aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive focus-visible:aria-invalid:outline-red size-5 shrink-0 cursor-pointer rounded-sm border outline-offset-1 transition-shadow focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:aria-invalid:ring-0 focus-visible:aria-invalid:outline focus-visible:aria-invalid:outline-2 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 hover:data-[state=checked]:brightness-120 data-[state=indeterminate]:border-blue-600 data-[state=indeterminate]:bg-blue-600 hover:data-[state=indeterminate]:brightness-120 data-[state=unchecked]:border-gray-300 hover:data-[state=unchecked]:border-gray-500"
        {...props}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-current transition-none"
        >
          <CheckIcon className="hidden size-4 stroke-[4] group-data-[state=checked]:block" />
          <MinusIcon className="hidden size-4 stroke-[4] group-data-[state=indeterminate]:block" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? <div className="grow">{label}</div> : null}
    </Label>
  );
}

export { Checkbox };
