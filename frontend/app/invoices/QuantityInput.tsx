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
  useEffect(
    () => setRawValue(value ? (value.hourly ? formatDuration(value.quantity) : value.quantity.toString()) : ""),
    [value],
  );

  return (
    <Input
      {...props}
      value={rawValue}
      onChange={(e) => setRawValue(e.target.value)}
      onBlur={() => {
        if (!rawValue.length) return onChange(null);

        const valueSplit = rawValue.split(":");
        if (valueSplit.length === 1) return onChange({ quantity: parseInt(valueSplit[0] ?? "0", 10), hourly: false });

        const hours = parseFloat(valueSplit[0] ?? "0");
        const minutes = parseFloat(valueSplit[1] ?? "0");
        onChange({
          quantity: Math.floor(isNaN(hours) ? 0 : hours * 60) + (isNaN(minutes) ? 0 : minutes),
          hourly: true,
        });
      }}
    />
  );
};

export default QuantityInput;
