import * as React from "react";
import { cn } from "@/utils";

export type InputProps = {
  help?: React.ReactNode;
  invalid?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

const Input = ({ className, type, help, invalid, id, ...props }: InputProps) => {
  const inputId = id ?? React.useId();
  const helpId = `${inputId}-help`;

  return (
    <div className="*:not-first:mt-2">
      <input
        id={inputId}
        type={type}
        data-slot="input"
        className={cn(
          "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm",
          "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50",
          "peer",
          invalid && "border-red",
          className,
        )}
        aria-invalid={invalid}
        aria-describedby={help != null ? helpId : undefined}
        {...props}
      />
      {help != null && (
        <p id={helpId} className="peer-aria-invalid:text-destructive mt-2 text-xs" role="alert" aria-live="polite">
          {help}
        </p>
      )}
    </div>
  );
};

export { Input };
