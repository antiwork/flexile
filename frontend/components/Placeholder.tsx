import React, { type ReactNode } from "react";
import { cn } from "@/utils";

const Placeholder = ({
  icon: Icon,
  children,
  className,
}: {
  icon?: React.ElementType;
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "grid justify-items-center gap-4 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600",
      className,
    )}
  >
    {Icon ? <Icon className="-mb-1 size-6 text-gray-600" aria-hidden="true" /> : null}
    {children}
  </div>
);

export default Placeholder;
