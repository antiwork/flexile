import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DashboardHeader({
  title,
  headerAction,
  showBreadcrumb = false,
  breadcrumbLinks,
}: {
  title: string;
  headerAction?: React.ReactNode;
  showBreadcrumb?: boolean;
  breadcrumbLinks?: { label: string; href: string };
}) {
  return (
    <header className="pt-2 md:pt-4">
      <div className="grid gap-y-8">
        <div className="grid items-center justify-between gap-3 md:flex">
          <div>
            <div className="flex items-center justify-between gap-2">
              <SidebarTrigger className="md:hidden" />
              <h1 className="text-sm font-bold">
                {!showBreadcrumb ? (
                  title
                ) : breadcrumbLinks ? (
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>{title}</BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{breadcrumbLinks.label}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                ) : null}
              </h1>
            </div>
          </div>

          {headerAction ? <div className="flex items-center gap-3 print:hidden">{headerAction}</div> : null}
        </div>
      </div>
    </header>
  );
}
