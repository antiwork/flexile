import React, { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";

function RadioButtons<T extends string | number>({
  options,
  value,
  onChange,
  label,
  invalid,
  disabled,
  help,
}: {
  options: { label: string; value: T; description?: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  invalid?: boolean;
  disabled?: boolean;
  help?: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const input of ref.current?.querySelectorAll("input") ?? []) {
      input.setCustomValidity(invalid ? (help ?? "Please double-check your choice.") : "");
    }
  }, [invalid, help]);

  return (
    <fieldset className="group">
      {label ? <legend className="mb-2 font-medium">{label}</legend> : null}
      <div ref={ref} role="radiogroup" className="grid auto-cols-fr gap-3 md:grid-flow-col">
        {options.map((option) => (
          <Label
            key={option.label}
            className={`border-input hover:bg-accent hover:text-accent-foreground has-[:checked]:text-primary flex cursor-pointer items-center gap-3 rounded-md border bg-transparent p-4 shadow-xs transition-[color,background-color,box-shadow,border-color] has-[:checked]:border-blue-600 has-[:checked]:bg-blue-500/10 ${invalid ? "border-destructive ring-destructive/20 has-[:checked]:border-destructive ring-2" : ""} ${disabled ? "pointer-events-none cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="sr-only"
              aria-invalid={invalid}
              aria-describedby={help ? `radio-help-${label}` : undefined}
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

export default RadioButtons;
