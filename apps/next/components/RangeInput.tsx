import React, { useEffect, useState } from "react";
import Input, { formGroupClasses } from "@/components/Input";
import { Label } from "@/components/ui/label";

const RangeInput = ({
  min,
  max,
  unit = "",
  value,
  onChange,
  label,
  id,
  ariaLabel,
  invalid,
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
}) => {
  const uid = React.useId();
  const [input, setInput] = useState(value.toString());

  useEffect(() => {
    setInput(value.toString());
  }, [value]);

  useEffect(() => {
    if (min != null && value < min) {
      onChange(min);
    }
  }, [min, value, onChange]);

  const handleInputChange = (newValue: string) => {
    setInput(newValue);
    let parsed = parseInt(newValue.replace(/,/gu, ""), 10);
    if (isNaN(parsed)) parsed = 0;

    const boundedValue = max != null && parsed > max ? max : min != null && parsed < min ? min : parsed;

    onChange(boundedValue);
  };

  return (
    <div className={formGroupClasses}>
      {label ? (
        <Label className="cursor-pointer" htmlFor={id ?? uid}>
          {label}
        </Label>
      ) : null}
      <div className="grid grid-cols-[1fr_6rem] gap-4">
        <div className="grid">
          <input
            id={id ?? uid}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={ariaLabel}
            type="range"
            min={min}
            max={max}
            className="col-span-2"
          />
          <div className="col-span-2 flex justify-between">
            {min != null && (
              <div aria-hidden="true" className="text-xs">
                {min.toLocaleString()}
                {unit !== "%" && "\u00A0"}
                {unit}
              </div>
            )}
            {max != null && (
              <div aria-hidden="true" className="text-right text-xs">
                {max.toLocaleString()}
                {unit !== "%" && "\u00A0"}
                {unit}
              </div>
            )}
          </div>
        </div>
        <Input
          value={input}
          onChange={handleInputChange}
          aria-hidden="true"
          inputMode="numeric"
          suffix={unit}
          invalid={invalid ?? false}
        />
      </div>
    </div>
  );
};

export default RangeInput;
