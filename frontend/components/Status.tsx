import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Circle } from "lucide-react";
import React from "react";
import { cn } from "@/utils";

export type Variant = "critical" | "primary" | "success" | "secondary";

const Status = ({
  variant,
  children,
  icon,
  className,
}: {
  variant?: Variant | undefined;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string | undefined;
}) => (
  <span className={cn("inline-flex items-center gap-2", className)}>
    <span
      className={cn("size-4", {
        "text-red": variant === "critical",
        "text-green": variant === "success",
        "text-blue-600": variant === "primary",
        "text-gray-500": variant === "secondary",
      })}
    >
      {icon ||
        (variant === "critical" ? (
          <ExclamationTriangleIcon />
        ) : variant === "success" ? (
          <CheckCircleIcon />
        ) : (
          <Circle className="h-4 w-4" />
        ))}
    </span>
    {children}
  </span>
);

export default Status;
