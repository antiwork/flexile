import React from "react";
import MainLayout from "@/components/layouts/Main";
import { usePathname } from "next/navigation";
import { navLinks } from ".";
import { useCurrentCompany, useCurrentUser } from "@/global";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const Layout = ({ children, headerActions }: { children: React.ReactNode; headerActions?: React.ReactNode }) => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const currentLink = navLinks(user, company).find((link) => link.route === pathname);

  const title = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>Equity</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentLink?.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  return (
    <MainLayout title={title} headerActions={headerActions}>
      {children}
    </MainLayout>
  );
};

export default Layout;
