import React from "react";
import { cn } from "@/utils";

export type Variant = "critical" | "primary" | "success" | "secondary";

const Status = ({
  variant,
  children,
  className,
}: {
  variant?: Variant | undefined;
  children?: React.ReactNode;
  className?: string | undefined;
}) => (
  <span
    className={cn(
      "inline-flex items-center",
      {
        "text-red": variant === "critical",
        "text-green": variant === "success",
        "text-blue-600": variant === "primary",
        "text-gray-500": variant === "secondary",
      },
      className,
    )}
  >
    {children}
  </span>
);

export default Status;
