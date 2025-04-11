import * as React from "react"

import { cn } from "../../utils"

export interface BasicInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export interface InputProps {
  className?: string;
  type?: string;
  label?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  help?: React.ReactNode;
  invalid?: boolean;
  onChange?: (text: string) => void;
  value?: string | null;
  disabled?: boolean;
  children?: React.ReactNode;
  [key: string]: any; // Allow other props
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, prefix, suffix, help, invalid, onChange, value, ...props }, ref) => {
    const inputId = React.useId();
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
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

    if (label !== undefined || prefix !== undefined || suffix !== undefined || help !== undefined || invalid !== undefined) {
      return (
        <div className="group grid gap-2">
          {label || props.children ? (
            <label htmlFor={inputId} className="cursor-pointer">
              {label || props.children}
            </label>
          ) : null}
          <div
            className={cn(
              "flex items-center rounded-md border border-gray-300 bg-white shadow-sm",
              "focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-1",
              invalid && "border-red",
              props.disabled && "bg-gray-100 opacity-50",
              className
            )}
          >
            {prefix ? <div className="ml-2 flex items-center text-gray-600">{prefix}</div> : null}
            <input
              id={inputId}
              ref={(e: HTMLInputElement) => {
                inputRef.current = e;
                if (typeof ref === 'function') {
                  ref(e);
                } else if (ref) {
                  ref.current = e;
                }
              }}
              type={type}
              value={value ?? ""}
              onChange={(e) => onChange?.(e.target.value)}
              className="h-full w-0 flex-1 border-0 bg-transparent p-2 focus:outline-hidden focus:ring-0 focus:shadow-none rounded-md"
              {...props}
            />
            {suffix ? <div className="mr-2 flex items-center text-gray-600">{suffix}</div> : null}
          </div>
          {help ? <div className={cn("text-xs text-gray-500", invalid && "text-red")}>{help}</div> : null}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input"

export { Input }
