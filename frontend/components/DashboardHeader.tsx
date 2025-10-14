import Link from "next/link";
import React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/utils";

type Breadcrumb = {
  label: string;
  href?: string;
};

export function DashboardHeader({
  title,
  breadcrumbs,
  headerActions,
  className,
}: {
  title?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  headerActions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("px-4 max-md:py-2 md:pt-4 print:visible print:*:visible", className)}>
      <div className="flex items-center justify-between gap-3 print:block">
        <div className="print:*:visible">
          <div className="flex items-center justify-between gap-2">
            <SidebarTrigger className="md:hidden print:hidden" />
            {breadcrumbs ? (
              <nav className="text-muted-foreground flex items-center gap-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span>›</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} className="hover:text-foreground">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">{crumb.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            ) : (
              <h1 className="text-xl font-semibold md:text-3xl md:font-bold print:text-4xl print:font-bold print:text-black">
                {title}
              </h1>
            )}
          </div>
        </div>

        {headerActions ? <div className="flex items-center gap-3 print:hidden">{headerActions}</div> : null}
      </div>
    </header>
  );
}
