import React, { useEffect, useRef, useState } from "react";

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
  required,
  ...props
}: InputProps) => {
  const inputId = id ?? React.useId();
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [touched, setTouched] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);

  useEffect(() => {
    // Only set custom validity if explicitly marked invalid from parent
    if (invalid) {
      inputRef.current?.setCustomValidity(
        typeof help === "string" ? help : value ? "This doesn't look correct." : "This field is required.",
      );
    } else {
      // Clear explicit invalidity
      inputRef.current?.setCustomValidity("");
    }
  }, [invalid, help, value]);

  const checkValidity = () => {
    if (!inputRef.current) return;

    // Check both explicit invalid prop and HTML5 validation
    const htmlInvalid = !inputRef.current.validity.valid;
    setIsInvalid(invalid === true || htmlInvalid);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTouched(true);
    checkValidity();

    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }

    if (touched) {
      checkValidity();
    }
  };

  const InputComponent = type === "textarea" ? "textarea" : "input";

  // Determine if we should show invalid state (only when touched and invalid)
  const showInvalid = touched && isInvalid;

  return (
    <div className={formGroupClasses}>
      {label || props.children ? (
        <label htmlFor={inputId} className="cursor-pointer">
          {label || props.children}
        </label>
      ) : null}
      <div
        className={`flex items-center ${formControlClasses} ${
          showInvalid ? "border-red" : ""
        } has-disabled:bg-gray-100 has-disabled:opacity-50 ${className}`}
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
          onChange={handleChange}
          onBlur={handleBlur}
          className="h-full w-0 flex-1 rounded-md bg-transparent p-2 focus:outline-hidden"
          required={required}
          {...props}
        />
        {suffix ? <div className="mr-2 flex items-center text-gray-600">{suffix}</div> : null}
      </div>
      {help ? <div className={formHelpClasses}>{help}</div> : null}
    </div>
  );
};

export default Input;
