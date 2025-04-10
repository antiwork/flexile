import React, { useEffect, useRef } from "react";
import { formControlClasses, formHelpClasses } from "@/components/Input";

function RadioButtons<T extends string | number>({
  options,
  value,
  onChange,
  label,
  invalid,
  disabled,
  help,
}: {
  options: { label: string; value: T; description?: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  invalid?: boolean;
  disabled?: boolean;
  help?: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const input of ref.current?.querySelectorAll("input") ?? []) {
      input.setCustomValidity(invalid ? (help ?? "Please double-check your choice.") : "");
    }
  }, [invalid, help]);

  return (
    <fieldset className="group">
      {label ? <legend className="mb-2">{label}</legend> : null}
      <div ref={ref} role="radiogroup" className="grid auto-cols-fr gap-2 md:grid-flow-col">
        {options.map((option) => (
          <label
            key={option.label}
            className={`has-invalid:border-red flex cursor-pointer items-center gap-2 p-3 has-disabled:cursor-not-allowed has-disabled:opacity-50 ${formControlClasses}`}
          >
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="invalid:accent-red size-5 outline-hidden"
            />
            {option.description ? (
              <div>
                <div className="font-medium">{option.label}</div>
                <span className="text-gray-500">{option.description}</span>
              </div>
            ) : (
              option.label
            )}
          </label>
        ))}
      </div>
      {help ? <div className={`mt-2 ${formHelpClasses}`}>{help}</div> : null}
    </fieldset>
  );
}

export default RadioButtons;
