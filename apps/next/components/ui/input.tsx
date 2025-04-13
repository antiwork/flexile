// apps/next/components/ui/input.tsx
import * as React from "react";
import { cn } from "@/utils";

export type InputProps = {
  invalid?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

const Input = ({ className, type, invalid, ...props }: InputProps) => (
  <input
    type={type}
    data-slot="input"
    className={cn(
      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm",
      "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
      "placeholder:text-muted-foreground",
      "focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-50",
      invalid && "border-red",
      className,
    )}
    {...props}
  />
);

export { Input };
