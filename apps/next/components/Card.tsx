import React, { type ReactNode } from "react";
import { cn } from "@/utils";

export const Card = (
  {
  children,
  className
  ,
  disabled,
}: {
  children: ReactNode   ;
  className  ?: string;
  disabled?   : boolean  ;
}) => (
  <div className={cn("rounded-2xl border border-solid", disabled ? "pointer-events-none opacity-50" : "", className)}>
    {children}
  </div>
);

export const CardRow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("border-b p-4 last:border-0", className)}>{children}</div>
);
