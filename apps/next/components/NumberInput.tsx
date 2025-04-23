"use client";

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils";

const MAXIMUM_FRACTION_DIGITS_ALLOWED_BY_SPEC = 100;

const NumberInput = ({
  value,
  onChange,
  onBlur,
  onFocus,
  prefix,
  suffix,
  invalid,
  decimal = false,
  maximumFractionDigits = MAXIMUM_FRACTION_DIGITS_ALLOWED_BY_SPEC,
  minimumFractionDigits,
  className,
  id,
  ...props
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
  decimal?: boolean;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  id?: string;
} & Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "onFocus" | "onBlur" | "inputMode" | "prefix" | "aria-invalid"
>) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState<string>("");

  const formatDisplayValue = (num: number | null) =>
    num?.toLocaleString(undefined, {
      maximumFractionDigits: decimal ? maximumFractionDigits : 0,
      minimumFractionDigits: decimal ? minimumFractionDigits : 0,
      useGrouping: false,
    }) ?? "";

  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatDisplayValue(value ?? null));
    }
  }, [value, isFocused, formatDisplayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentInput = e.target.value;

    if (currentInput === "" || currentInput === "-" || (decimal && currentInput === ".")) {
      setInputValue(currentInput);
      onChange(null);
      return;
    }

    const sanitized = currentInput
      .replace(decimal ? /[^\d.-]/gu : /[^\d-]/gu, "")
      .replace(decimal ? /(\..*)\./gu : /\./gu, "$1")
      .replace(/(?!^)-/gu, "");

    if (sanitized !== currentInput && currentInput !== "-" && decimal && currentInput !== ".") {
      e.target.value = sanitized;
    }

    let valueToParse = sanitized;
    if (decimal) {
      const parts = sanitized.split(".");
      if (parts[1] && parts[1].length > maximumFractionDigits) {
        parts[1] = parts[1].slice(0, maximumFractionDigits);
        valueToParse = parts.join(".");
        e.target.value = valueToParse;
      }
    }

    const parsed = decimal ? parseFloat(valueToParse) : parseInt(valueToParse, 10);

    if (!isNaN(parsed)) {
      setInputValue(valueToParse);
      onChange(parsed);
    } else if (valueToParse === "-") {
      setInputValue(valueToParse);
      onChange(null);
    } else {
      setInputValue(formatDisplayValue(value ?? null));
      onChange(value ?? null);
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
    setIsFocused(false);
    setInputValue(formatDisplayValue(value ?? null));
    onBlur?.(e);
  };

  const handleFocus: React.FocusEventHandler<HTMLInputElement> = (e) => {
    setIsFocused(true);
    onFocus?.(e);
    e.target.select();
  };

  const inputClasses = cn(className, prefix && "pl-7", suffix && "pr-10");

  return (
    <div className="relative">
      <Input
        id={id}
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        inputMode={decimal ? "decimal" : "numeric"}
        className={inputClasses}
        aria-invalid={invalid}
        {...props}
      />

      {prefix ? (
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm peer-disabled:opacity-50">
          {prefix}
        </span>
      ) : null}

      {suffix ? (
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm peer-disabled:opacity-50">
          {suffix}
        </span>
      ) : null}
    </div>
  );
};

export default NumberInput;
