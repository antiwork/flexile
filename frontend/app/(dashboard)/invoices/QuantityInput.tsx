import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/utils/time";

type Value = { quantity: number; hourly: boolean } | null;

const QuantityInput = ({
  value,
  onChange,
  ...props
}: {
  value: Value;
  onChange: (value: Value) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) => {
  const [rawValue, setRawValue] = useState("");

  const parseRawValue = (raw: string): Value => {
    if (!raw.length) return null;
    const valueSplit = raw.split(":");
    if (valueSplit.length === 1) return { quantity: parseFloat(valueSplit[0] ?? "0"), hourly: false };
    const hours = parseInt(valueSplit[0] ?? "0", 10);
    const minutes = parseInt(valueSplit[1] ?? "0", 10);
    return {
      quantity: Math.floor(isNaN(hours) ? 0 : hours * 60) + (isNaN(minutes) ? 0 : minutes),
      hourly: true,
    };
  };

  const onChangeLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRawValue = e.target.value;
    setRawValue(newRawValue);
    const parsedValue = parseRawValue(newRawValue);
    onChange(parsedValue);
  };

  useEffect(() => {
    const currentParsedValue = parseRawValue(rawValue);
    const valuesEqual =
      (currentParsedValue === null && value === null) ||
      (currentParsedValue !== null &&
        value !== null &&
        currentParsedValue.quantity === value.quantity &&
        currentParsedValue.hourly === value.hourly);
    if (!valuesEqual)
      setRawValue(value ? (value.hourly ? formatDuration(value.quantity) : value.quantity.toString()) : "");
  }, [value, rawValue, parseRawValue]);

  return <Input {...props} value={rawValue} onChange={onChangeLocal} />;
};

export default QuantityInput;
