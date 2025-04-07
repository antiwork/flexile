import { cn } from "@/utils";
import React from "react";

const Badge = ({
  color,
  outline = false,
  children,
  className,
  role,
}: {
  color: "blue" | "gray";
  outline?: boolean;
  children: React.ReactNode;
  className?: string;
  role?: string;
}) => {
  const colorClasses = outline
    ? color === "blue"
      ? "text-blue-600"
      : "text-gray-600"
    : color === "blue"
      ? "bg-blue-600 text-white"
      : "bg-gray-600 text-white";

  return (
    <span
      role={role}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full",
        { "border border-current bg-transparent text-inherit": outline },
        colorClasses,
        className,
      )}
    >
      {children}
    </span>
  );
};

export default Badge;
