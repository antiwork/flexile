import React, { useEffect, useState } from "react";
import Input from "@/components/Input";

const NumberInput = ({
  value,
  onChange,
  ...props
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "inputMode">) => {
  const [input, setInput] = useState(value?.toString() ?? "");
  useEffect(() => setInput(value?.toString() ?? ""), [value]);

  return (
    <Input
      value={input}
      onChange={(value) => {
        const newInput = value.replace(/\D/gu, "");
        setInput(newInput);

        const parsed = parseInt(newInput, 10);
        onChange(isNaN(parsed) ? null : parsed);
      }}
      inputMode="numeric"
      {...props}
    />
  );
};

export default NumberInput;
