import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/utils/time";

type DurationInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">;

const DurationInput = ({ value, onChange, ...props }: DurationInputProps) => {
  const [rawValue, setRawValue] = useState("");
  useEffect(() => setRawValue(value ? formatDuration(value) : ""), [value]);

  return (
    <Input
      {...props}
      value={rawValue}
      onChange={(e) => setRawValue(e.target.value)}
      onBlur={() => {
        if (!rawValue.length) return onChange(null);

        const valueSplit = rawValue.split(":");
        const hours = parseFloat(valueSplit[0] ?? "0");
        const minutes = parseFloat(valueSplit[1] ?? "0");

        onChange(Math.floor(isNaN(hours) ? 0 : hours * 60) + (isNaN(minutes) ? 0 : minutes));
      }}
      placeholder="HH:MM"
    />
  );
};

export default DurationInput;
