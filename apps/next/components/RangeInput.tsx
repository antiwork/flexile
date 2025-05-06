import React, { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/utils";

export const formGroupClasses = "group grid gap-2";

const RangeInput = ({
  min = 0,
  max = 100,
  unit,
  value,
  onChange,
  label,
  id,
  ariaLabel,
  invalid,
  className,
  disabled,
}: {
  min?: number;
  max?: number;
  unit?: string;
  value: number;
  onChange: (value: number) => void;
  label?: React.ReactNode;
  id?: string;
  ariaLabel?: string;
  invalid?: boolean;
  className?: string;
  disabled?: boolean;
}) => {
  const uid = React.useId();
  const componentId = id ?? uid;

  const [sliderValue, setSliderValue] = useState<number[]>([value]);
  const [inputValue, setInputValue] = useState<string>(value.toString());

  useEffect(() => {
    const clampedValue = Math.min(max, Math.max(min, value));
    setSliderValue([clampedValue]);
    setInputValue(clampedValue.toString());
  }, [value, min, max]);

  const validateAndUpdateValue = useCallback(
    (rawValue: string) => {
      if (rawValue === "" || rawValue === "-") {
        const defaultValue = Math.max(min, 0);
        setInputValue(defaultValue.toString());
        setSliderValue([defaultValue]);
        onChange(defaultValue);
        return;
      }

      const numValue = parseFloat(rawValue);

      if (isNaN(numValue)) {
        const currentSliderVal = sliderValue[0];
        if (currentSliderVal !== undefined) {
          setInputValue(currentSliderVal.toString());
        }
        return;
      }

      const clampedValue = Math.min(max, Math.max(min, numValue));

      setSliderValue([clampedValue]);
      setInputValue(clampedValue.toString());
      if (typeof clampedValue === "number") {
        onChange(clampedValue);
      }
    },
    [sliderValue, min, max, onChange],
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Update the displayed text immediately
    setInputValue(rawValue);

    // Validate and propagate the change if the pattern is valid
    if (rawValue === "" || rawValue === "-" || /^-?\d*\.?\d*$/u.test(rawValue)) {
      validateAndUpdateValue(rawValue);
    }
  }, []);

  const handleSliderChange = useCallback(
    (newValue: number[]) => {
      const firstValue = newValue[0];
      setSliderValue(newValue);
      if (firstValue !== undefined) {
        setInputValue(firstValue.toString());
        onChange(firstValue);
      }
    },
    [onChange],
  );

  return (
    <div className={cn(formGroupClasses, className)}>
      {label ? (
        <Label className="cursor-pointer" htmlFor={componentId}>
          {label}
        </Label>
      ) : null}
      <div className="flex items-center gap-4">
        <Slider
          value={sliderValue}
          onValueChange={handleSliderChange}
          min={min}
          max={max}
          step={1}
          aria-label={ariaLabel ?? (typeof label === "string" ? label : "Range slider")}
          className="grow"
          disabled={disabled ?? false}
        />
        <div className="border-input bg-background ring-offset-background focus-within:ring-ring flex h-8 items-center rounded-md border focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none">
          <Input
            id={componentId}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={() => validateAndUpdateValue(inputValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                validateAndUpdateValue(inputValue);
              }
            }}
            aria-invalid={invalid}
            aria-label={ariaLabel ?? (typeof label === "string" ? `${label} value` : "Range value input")}
            inputMode="numeric"
            className={cn(
              "h-full w-16 border-0 bg-transparent px-2 py-1 text-right shadow-none focus-visible:ring-0",
              unit ? "rounded-r-none" : "",
            )}
            disabled={disabled}
          />
          {unit ? (
            <span className="text-muted-foreground pointer-events-none shrink-0 py-1 pr-2 text-xs">{unit}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RangeInput;
