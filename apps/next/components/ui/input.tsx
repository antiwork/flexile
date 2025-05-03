import * as React from "react";
import { cn } from "@/utils/index";

type InputProps = Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value?: React.ComponentProps<"input">["value"] | null;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

function Input({ className, type, value, ...props }: InputProps) {
  return (
    <input
      type={type}
      value={type !== "file" ? (value ?? "") : undefined}
      onChange={props.onChange}
      data-slot="input"
      className={cn(
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        type === "file" &&
          "file:text-foreground file:border-input p-0 file:me-4 file:inline-flex file:h-9 file:rounded-l-md file:border-0 file:border-e file:bg-transparent file:px-4 file:font-normal",
        "focus-visible:border-ring focus-visible:ring-ring/15 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
