import React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DashboardHeader({ title, headerActions }: { title: React.ReactNode; headerActions?: React.ReactNode }) {
  return (
    <header className="px-4 max-md:py-2 md:pt-4">
      <div className="grid gap-y-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <SidebarTrigger className="md:hidden" />
              <h1 className="text-xl font-semibold md:text-3xl md:font-bold">{title}</h1>
            </div>
          </div>

          {headerActions ? <div className="flex items-center gap-3 print:hidden">{headerActions}</div> : null}
        </div>
      </div>
    </header>
  );
}
