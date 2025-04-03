import React, { useEffect, useRef } from "react";

export const formGroupClasses = "group grid gap-2";
export const formControlClasses = "rounded-md border bg-white focus-within:ring-3 focus-within:ring-blue-50";
export const formHelpClasses = "text-xs text-gray-500 group-has-invalid:text-red";

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>,
  "prefix" | "onChange" | "value"
> & {
  label?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  help?: React.ReactNode;
  invalid?: boolean | undefined;
  ref?: React.RefObject<(HTMLInputElement | HTMLTextAreaElement) | null>;
  type?: "text" | "date" | "datetime-local" | "email" | "password" | "url" | "textarea" | "number";
  onChange?: (text: string) => void;
  value?: string | null;
};

const Input = ({
  id,
  type = "text",
  className,
  label,
  prefix,
  suffix,
  help,
  invalid,
  value,
  onChange,
  ref,
  ...props
}: InputProps) => {
  const inputId = id ?? React.useId();
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      invalid
        ? typeof help === "string"
          ? help
          : value
            ? "This doesn't look correct."
            : "This field is required."
        : "",
    );
  }, [invalid, help, value]);

  const InputComponent = type === "textarea" ? "textarea" : "input";

  return (
    <div className={formGroupClasses}>
      {label || props.children ? (
        <label htmlFor={inputId} className="cursor-pointer">
          {label || props.children}
        </label>
      ) : null}
      <div
        className={`has-invalid:border-red flex items-center has-disabled:bg-gray-100 has-disabled:opacity-50 ${formControlClasses} ${className}`}
      >
        {prefix ? <div className="ml-2 flex items-center text-gray-600">{prefix}</div> : null}
        <InputComponent
          id={inputId}
          ref={(e: HTMLInputElement & HTMLTextAreaElement) => {
            inputRef.current = e;
            if (ref) ref.current = e;
          }}
          type={type !== "textarea" ? type : undefined}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-full w-0 flex-1 rounded-md bg-transparent p-2 focus:outline-hidden"
          {...props}
        />
        {suffix ? <div className="mr-2 flex items-center text-gray-600">{suffix}</div> : null}
      </div>
      {help ? <div className={formHelpClasses}>{help}</div> : null}
    </div>
  );
};

export default Input;
