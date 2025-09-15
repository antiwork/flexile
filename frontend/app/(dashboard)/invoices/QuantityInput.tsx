import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/utils/time";

type QuantityValue = { quantity: number; hourly: boolean } | null;

interface QuantityInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: QuantityValue;
  onChange: (value: QuantityValue) => void;
}

const QuantityInput = ({ value, onChange, ...inputProps }: QuantityInputProps) => {
  const [displayValue, setDisplayValue] = useState(() => {
    if (!value) return "";
    return value.hourly ? formatDuration(value.quantity) : String(value.quantity);
  });
  const [hasFocus, setHasFocus] = useState(false);
  const lastPropValue = useRef(value);

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

  useEffect(() => {
    if (!hasFocus) {
      const valueChanged =
        lastPropValue.current?.quantity !== value?.quantity || lastPropValue.current?.hourly !== value?.hourly;

      if (valueChanged) {
        setDisplayValue(formatDisplayValue(value));
        lastPropValue.current = value;
      }
    }
  }, [value, hasFocus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);

    const parsed = parseInput(newValue);
    onChange(parsed);
  };

  return (
    <Input
      {...inputProps}
      value={displayValue}
      onChange={handleInputChange}
      onBlur={() => setHasFocus(false)}
      onFocus={() => setHasFocus(true)}
    />
  );
};

export default QuantityInput;
