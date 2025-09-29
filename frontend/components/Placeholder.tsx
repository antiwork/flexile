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
      "border-muted text-muted-foreground grid justify-items-center gap-4 rounded-lg border border-dashed p-6 text-center text-sm",
      className,
    )}
  >
    {Icon ? <Icon className="text-muted-foreground -mb-1 size-6" aria-hidden="true" /> : null}
    {children}
  </div>
);

export default Placeholder;
