"use client";

import * as React from "react";
import { RadioGroup as BaseRadioGroup, RadioGroupItem, RadioGroupIndicator } from "@radix-ui/react-radio-group";
import { cn } from "@/utils/index";
import { Label } from "@/components/ui/label";

type Option<T> = {
  label: string;
  value: T;
  description?: string;
};

type Props<T extends string | number> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  invalid?: boolean;
  disabled?: boolean;
  help?: string | undefined;
};

function RadioGroup<T extends string | number>({ options, value, onChange, label, invalid, disabled, help }: Props<T>) {
  const stringValue = String(value);

  return (
    <fieldset className="group">
      {label ? <legend className="mb-2 font-medium">{label}</legend> : null}
      <BaseRadioGroup
        value={stringValue}
        onValueChange={(v) => onChange(options.find((o) => String(o.value) === v)!.value)}
        data-slot="radio-group"
        className="grid auto-cols-fr gap-2 md:grid-flow-col"
        disabled={disabled}
      >
        {options.map((option) => {
          const stringOptionValue = String(option.value);
          return (
            <Label
              key={stringOptionValue}
              data-state={value === option.value ? "checked" : "unchecked"}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border bg-transparent p-4 shadow-xs transition-all",
                "hover:bg-accent hover:text-accent-foreground border-input",

                "transition-[color,background-color,box-shadow,border-color] data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-500/10",
                invalid && "border-destructive ring-destructive/20 ring-2",
                disabled && "pointer-events-none cursor-not-allowed opacity-50",
              )}
            >
              <RadioGroupItem
                id={`radio-${stringOptionValue}`}
                value={stringOptionValue}
                disabled={disabled}
                className={cn(
                  "border-input sr-only size-3 shrink-0 cursor-pointer rounded-full border transition-all outline-none",

                  "data-[state=checked]:border-none data-[state=checked]:ring-1 data-[state=checked]:ring-blue-500",
                )}
              >
                <RadioGroupIndicator className="relative flex size-full items-center justify-center after:block after:size-2 after:rounded-full after:bg-blue-500" />
              </RadioGroupItem>

              {option.description ? (
                <div>
                  <div className="font-medium">{option.label}</div>
                  <span className="text-muted-foreground text-sm leading-none">{option.description}</span>
                </div>
              ) : (
                <span className="font-medium">{option.label}</span>
              )}
            </Label>
          );
        })}
      </BaseRadioGroup>
      {help ? (
        <div
          id={help ? `radio-help-${label}` : undefined}
          className={`mt-2 text-sm ${invalid ? "text-destructive" : "text-muted-foreground"}`}
        >
          {help}
        </div>
      ) : null}
    </fieldset>
  );
}

export { RadioGroup };
