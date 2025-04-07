import { cn } from "@/utils";
import React, { useEffect, useRef } from "react";

const Checkbox = ({
  switch: isSwitch,
  label,
  invalid,
  checked,
  onChange,
  className,
  ...props
}: {
  switch?: boolean;
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
        className={cn("peer invalid:accent-red size-6 cursor-pointer transition-all", {
          "invalid:border-red checked:invalid:bg-red w-10 appearance-none rounded-full border checked:bg-blue-600":
            isSwitch,
        })}
        role={isSwitch ? "switch" : undefined}
        {...props}
      />
      {isSwitch ? (
        <div className="pointer-events-none absolute left-1 size-4 cursor-pointer rounded-full bg-black transition-all peer-checked:left-5 peer-checked:bg-white" />
      ) : null}
      {label ? <div className="grow">{label}</div> : null}
    </label>
  );
};

export default Checkbox;
