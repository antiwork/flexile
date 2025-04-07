import Input from "@/components/Input";
import { formatDuration } from "@/utils/time";
import { useEffect, useState } from "react";

const DurationInput = ({
  value,
  onChange,
  ...props
}: {
  value: number | null;
  onChange: (value: number | null) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) => {
  const [rawValue, setRawValue] = useState("");
  useEffect(() => setRawValue(value ? formatDuration(value) : ""), [value]);

  return (
    <Input
      {...props}
      value={rawValue}
      onChange={setRawValue}
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
