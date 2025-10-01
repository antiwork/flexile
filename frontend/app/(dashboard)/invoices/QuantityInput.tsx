import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/utils/time";

type QuantityValue = { quantity: number; hourly: boolean } | null;

interface QuantityInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: QuantityValue;
  onChange: (value: QuantityValue) => void;
}

const QuantityInput = ({ value, onChange, ...inputProps }: QuantityInputProps) => {
  const [localValue, setLocalValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const parseInput = (input: string): QuantityValue => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.includes(":")) {
      const [hoursStr = "", minutesStr = ""] = trimmed.split(":");
      const hours = parseInt(hoursStr, 10) || 0;
      const minutes = parseInt(minutesStr, 10) || 0;
      return { quantity: hours * 60 + minutes, hourly: true };
    }

    const num = parseFloat(trimmed);
    return isNaN(num) ? null : { quantity: num, hourly: false };
  };

  const formatDisplayValue = (val: QuantityValue): string => {
    if (!val) return "";
    return val.hourly ? formatDuration(val.quantity) : String(val.quantity);
  };

  const displayValue = isFocused ? localValue : formatDisplayValue(value);

  return (
    <Input
      {...inputProps}
      value={displayValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        const parsed = parseInput(e.target.value);
        onChange(parsed);
      }}
      onFocus={() => {
        setIsFocused(true);
        setLocalValue(formatDisplayValue(value));
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
    />
  );
};

export default QuantityInput;
