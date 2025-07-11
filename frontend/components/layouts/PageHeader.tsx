"use client";
import { useEffect } from "react";
import { useLayoutStore } from "./LayoutStore";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../ui/breadcrumb";
import type { TabLink } from "../Tabs";

interface PageHeaderProps {
  title?: React.ReactNode;
  headerActions?: React.ReactNode;
  currentLink?: TabLink | null;
}

export function PageHeader({ title = "Equity", headerActions = null, currentLink = null }: PageHeaderProps) {
  const setTitle = useLayoutStore((s) => s.setTitle);
  const setHeaderActions = useLayoutStore((s) => s.setHeaderActions);

  useEffect(() => {
    const titleNode = currentLink ? (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>{title}</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentLink.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ) : (
      title
    );

    setTitle(titleNode);
    setHeaderActions(headerActions);
  }, [title, headerActions, currentLink, setTitle, setHeaderActions]);

  return null;
}
