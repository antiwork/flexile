import React, { useEffect, useId, useRef } from "react";
import { formControlClasses, formGroupClasses, formHelpClasses } from "@/components/Input";

export type Option = Readonly<{ label: string; value: string }>;

export default function Select({
  id,
  className,
  label,
  ariaLabel,
  disabled = false,
  help,
  invalid = false,
  options,
  placeholder,
  value,
  onChange,
  ref,
}: {
  id?: string;
  className?: string;
  label?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  help?: string | undefined;
  invalid?: boolean | undefined;
  options: readonly Option[];
  placeholder?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  ref?: React.RefObject<HTMLSelectElement | null>;
}) {
  const uid = useId();
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.setCustomValidity(invalid ? (help ?? "Please select a valid option.") : "");
    }
  }, [invalid, help]);

  return (
    <div className={`${formGroupClasses} ${className || ""}`}>
      {label ? (
        <label htmlFor={id ?? uid} className="cursor-pointer">
          {label}
        </label>
      ) : null}
      <select
        id={id ?? uid}
        ref={(element) => {
          selectRef.current = element;
          if (ref && element) ref.current = element;
        }}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`${formControlClasses} invalid:border-red w-full p-2 focus:outline-hidden disabled:bg-gray-100 disabled:opacity-50`}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option, index) => (
          <option key={index} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {help ? <div className={formHelpClasses}> {help}</div> : null}
    </div>
  );
}
