import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/utils/time";

type Value = { quantity: number; hourly: boolean } | null;

const isValidNumber = (val: string): boolean => /^\d+(\.\d+)?$/u.test(val); // Matches positive integers or decimals
const isValidDuration = (val: string): boolean => {
  // Matches "h:mm", "hh:mm", "hhh:mm", etc.
  const durationRegex = /^\d+:\d{2}$/u;
  if (!durationRegex.test(val)) {
    return false;
  }

  const [hours, minutes] = val.split(":").map(Number);

  if (hours === undefined || minutes === undefined) return false;

  // Check if hours and minutes are non-negative and minutes are within a valid range (0-59)
  // Ensure the total duration is greater than zero
  return hours >= 0 && minutes >= 0 && minutes <= 59 && hours * 60 + minutes > 0;
};

const isNumberOrDuration = (val: string): boolean => isValidNumber(val) || isValidDuration(val);

const QuantityInput = ({
  value,
  onChange,
  ...props
}: {
  value: Value;
  onChange: (value: Value) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) => {
  const [rawValue, setRawValue] = useState("");
  const [isValid, setIsValid] = useState(true);

  useEffect(
    () => setRawValue(value ? (value.hourly ? formatDuration(value.quantity) : value.quantity.toString()) : ""),
    [value],
  );

  return (
    <Input
      {...props}
      value={rawValue}
      onChange={(e) => {
        setRawValue(e.target.value);
        setIsValid(isNumberOrDuration(e.target.value));
      }}
      onBlur={() => {
        if (!isValid || !rawValue.length) return onChange(null);

        const valueSplit = rawValue.split(":");
        if (valueSplit.length === 1) return onChange({ quantity: Number(valueSplit[0]), hourly: false });

        const hours = Number(valueSplit[0]);
        const minutes = Number(valueSplit[1]);
        onChange({
          quantity: Math.floor(hours * 60) + minutes,
          hourly: true,
        });
      }}
      aria-invalid={!isValid}
    />
  );
};

export default QuantityInput;
