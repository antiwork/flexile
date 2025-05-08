import * as React from "react";
import { cn } from "@/utils/index";

type InputProps = React.ComponentProps<"input">;
function Input({
  className,
  type,
  value,
  prefix,
  suffix,
  ...props
}: Omit<InputProps, "value"> & {
  value?: InputProps["value"] | null;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value ?? ""}
        data-slot="input"
        className={cn(
          "file:text-foreground file:border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:me-4 file:inline-flex file:h-full file:border-e file:bg-transparent file:px-4 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&[type=file]]:p-0",
          "focus-visible:border-ring focus-visible:ring-ring/15 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          prefix && "pl-7",
          suffix && "pr-10",
          className,
        )}
        {...props}
      />
      {prefix ? (
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm peer-disabled:opacity-50">
          {prefix}
        </span>
      ) : null}

      {suffix ? (
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm peer-disabled:opacity-50">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export { Input };
