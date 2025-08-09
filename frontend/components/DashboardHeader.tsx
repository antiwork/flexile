import React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/utils";

export function DashboardHeader({
  title,
  headerActions,
  className,
}: {
  title: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("px-4 max-md:py-2 md:pt-4 print:visible print:*:visible", className)}>
      <div className="flex items-center justify-between gap-3 print:block">
        <div className="print:*:visible">
          <div className="flex items-center justify-between gap-2">
            <SidebarTrigger className="md:hidden print:hidden" />
            <h1 className="text-xl font-semibold md:text-3xl md:font-bold print:text-4xl print:font-bold print:text-black">
              {title}
            </h1>
          </div>
        </div>

        {headerActions ? <div className="flex items-center gap-3 print:hidden">{headerActions}</div> : null}
      </div>
    </header>
  );
}
