import * as React from "react"

import { cn } from "../../utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  help?: React.ReactNode;
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, help, invalid, ...props }, ref) => {
    const textareaId = React.useId();
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
      textareaRef.current?.setCustomValidity(
        invalid
          ? typeof help === "string"
            ? help
            : props.value
              ? "This doesn't look correct."
              : "This field is required."
          : "",
      );
    }, [invalid, help, props.value]);

    if (label !== undefined || help !== undefined || invalid !== undefined) {
      return (
        <div className="group grid gap-2">
          {label ? (
            <label htmlFor={textareaId} className="cursor-pointer">
              {label}
            </label>
          ) : null}
          <div
            className={cn(
              "relative flex rounded-md border border-gray-300 bg-white shadow-sm",
              "focus-within:ring-1 focus-within:ring-gray-200 focus-within:ring-offset-1",
              invalid && "border-red",
              props.disabled && "bg-gray-100 opacity-50",
              className
            )}
          >
            <textarea
              id={textareaId}
              ref={(e: HTMLTextAreaElement) => {
                textareaRef.current = e;
                if (typeof ref === 'function') {
                  ref(e);
                } else if (ref) {
                  ref.current = e;
                }
              }}
              className="min-h-[80px] w-full resize-y rounded-md border-0 bg-transparent p-2 focus:outline-hidden focus:ring-0 focus:shadow-none"
              {...props}
            />
          </div>
          {help ? <div className={cn("text-xs text-gray-500", invalid && "text-red")}>{help}</div> : null}
        </div>
      );
    }

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea"

export { Textarea }
