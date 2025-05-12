import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils";

function RadioButtons<T extends string | number>({
  options,
  value,
  onChange,
  className,
  disabled,
  "aria-invalid": ariaInvalid,
}: {
  options: { label: string; value: T; description?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}) {
  return (
    <div role="radiogroup" className={cn("grid auto-cols-fr gap-3 md:grid-flow-col", className)}>
      {options.map((option) => (
        <Label
          key={option.label}
          className={`border-input hover:bg-accent hover:text-accent-foreground has-[:checked]:text-primary flex cursor-pointer items-center gap-3 rounded-md border bg-transparent p-4 shadow-xs transition-[color,background-color,box-shadow,border-color] has-[:checked]:border-blue-600 has-[:checked]:bg-blue-500/10 ${ariaInvalid ? "border-destructive ring-destructive/20 has-[:checked]:border-destructive ring-2" : ""} ${disabled ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
        >
          <input
            type="radio"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
            disabled={disabled}
            aria-invalid={ariaInvalid}
          />
          {option.description ? (
            <div>
              <div className="font-medium">{option.label}</div>
              <span className="text-muted-foreground text-sm leading-none">{option.description}</span>
            </div>
          ) : (
            <span className="font-medium">{option.label}</span>
          )}
        </Label>
      ))}
    </div>
  );
}

export default RadioButtons;
