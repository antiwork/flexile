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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    const parsed = parseInput(newValue);
    onChange(parsed);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setLocalValue(formatDisplayValue(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const displayValue = isFocused ? localValue : formatDisplayValue(value);

  return (
    <Input
      {...inputProps}
      value={displayValue}
      onChange={handleInputChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};

export default QuantityInput;
