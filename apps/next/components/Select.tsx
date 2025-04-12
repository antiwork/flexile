import React, { useId } from "react";
import { formGroupClasses, formHelpClasses } from "@/components/Input";
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/utils";

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
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const uid = useId();
  const selectId = id ?? uid;

  return (
    <div className={cn(formGroupClasses, className)}>
      {label ? (
        <label htmlFor={selectId} className="cursor-pointer">
          {label}
        </label>
      ) : null}
      <ShadcnSelect value={value ?? ""} onValueChange={onChange} disabled={disabled} name={selectId}>
        <SelectTrigger
          id={selectId}
          ref={ref}
          className={cn("w-full focus:outline-hidden", invalid && "border-red", disabled && "bg-gray-100 opacity-50")}
          aria-label={ariaLabel}
          aria-invalid={invalid}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadcnSelect>
      {help ? <div className={formHelpClasses}>{help}</div> : null}
    </div>
  );
}
