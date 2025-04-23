import React, { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  ref?: React.Ref<(HTMLInputElement | HTMLTextAreaElement) | null>;
  type?: "text" | "date" | "datetime-local" | "email" | "password" | "url" | "textarea";
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className={formGroupClasses}>
      {label || props.children ? (
        <Label htmlFor={inputId} className="cursor-pointer">
          {label || props.children}
        </Label>
      ) : null}
      <div
        className={`has-invalid:border-red flex items-center has-disabled:bg-gray-100 has-disabled:opacity-50 ${formControlClasses} ${className}`}
      >
        {prefix ? <div className="ml-2 flex items-center text-gray-600">{prefix}</div> : null}
        {type === "textarea" ? (
          <Textarea
            id={inputId}
            ref={(e: HTMLTextAreaElement) => {
              if (typeof ref === "function") ref(e);
              else if (ref) ref.current = e;
            }}
            value={value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value)}
            className="h-full w-0 flex-1 rounded-md bg-transparent p-2 focus:outline-hidden"
            {...props}
          />
        ) : (
          <input
            id={inputId}
            ref={(e: HTMLInputElement) => {
              inputRef.current = e;
              if (typeof ref === "function") ref(e);
              else if (ref) ref.current = e;
            }}
            type={type}
            value={value ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
            className="h-full w-0 flex-1 rounded-md bg-transparent p-2 focus:outline-hidden"
            {...props}
          />
        )}
        {suffix ? <div className="mr-2 flex items-center text-gray-600">{suffix}</div> : null}
      </div>
      {help ? <div className={formHelpClasses}>{help}</div> : null}
    </div>
  );
};

export default Input;
