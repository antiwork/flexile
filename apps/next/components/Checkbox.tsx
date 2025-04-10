import { cn } from "@/utils";
import React, { useEffect, useRef } from "react";

const Checkbox = ({
  label,
  invalid,
  checked,
  onChange,
  className,
  ...props
}: {
  label?: React.ReactNode;
  invalid?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => inputRef.current?.setCustomValidity(invalid ? `Please ${checked ? "uncheck" : "check"} this field.` : ""),
    [invalid, checked],
  );

  return (
    <label className={cn("has-invalid:text-red relative flex cursor-pointer items-center gap-2", className)}>
      <input
        ref={inputRef}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        type="checkbox"
        className="peer invalid:accent-red size-6 cursor-pointer transition-all"
        {...props}
      />
      {label ? <div className="grow">{label}</div> : null}
    </label>
  );
};

export default Checkbox;
